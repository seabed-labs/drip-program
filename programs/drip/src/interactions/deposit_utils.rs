use crate::errors::ErrorCode;
use crate::interactions::token::TransferToken;
use crate::math::calculate_periodic_drip_amount;
use crate::sign;
use crate::state::vault::Vault;
use crate::state::{Position, VaultPeriod};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token;
use anchor_spl::token::{Mint, MintTo, Token, TokenAccount};
use mpl_token_metadata::instruction::create_metadata_accounts_v3;
use spl_token::instruction::AuthorityType;

const DRIP_METADATA_NAME: &str = "Drip Position";
const DRIP_METADATA_SYMBOL: &str = "DP";

fn get_metadata_url(position_nft_mint_pubkey: &Pubkey) -> String {
    format!(
        "https://api.drip.dcaf.so/v1/drip/position/{}/metadata",
        position_nft_mint_pubkey
    )
}

pub fn handle_deposit<'info>(
    // Accounts
    depositor: &Signer<'info>,
    rent: &Sysvar<'info, Rent>,
    token_program: &Program<'info, Token>,
    system_program: &Program<'info, System>,
    vault_token_a_account: &Account<'info, TokenAccount>,
    user_token_a_account: &Account<'info, TokenAccount>,
    user_position_nft_mint: &Account<'info, Mint>,
    user_position_nft_account: &Account<'info, TokenAccount>,
    vault: &mut Account<'info, Vault>,
    vault_period_end: &mut Account<'info, VaultPeriod>,
    user_position: &mut Account<'info, Position>,
    user_position_pda_bump: Option<&u8>,
    referral: Option<&Account<'info, TokenAccount>>,
    // Params
    params: DepositParams,
    // With/Without Metadata
    with_metadata: Option<(
        &Program<'info, MetaplexTokenMetadata>,
        &UncheckedAccount<'info>,
    )>,
) -> Result<()> {
    /* MANUAL CHECKS + COMPUTE (CHECKS) */

    let periodic_drip_amount =
        calculate_periodic_drip_amount(params.token_a_deposit_amount, params.number_of_swaps);

    if periodic_drip_amount == 0 {
        return Err(ErrorCode::PeriodicDripAmountIsZero.into());
    }

    let token_transfer = TransferToken::new(
        token_program,
        user_token_a_account,
        vault_token_a_account,
        params.token_a_deposit_amount,
    );
    let referral_pubkey = if let Some(referral) = referral {
        Some(referral.key())
    } else {
        None
    };
    /* STATE UPDATES (EFFECTS) */

    vault.increase_drip_amount(periodic_drip_amount);
    vault_period_end.increase_drip_amount_to_reduce(periodic_drip_amount);
    user_position.init(
        vault.key(),
        user_position_nft_mint.key(),
        params.token_a_deposit_amount,
        vault.last_drip_period,
        params.number_of_swaps,
        periodic_drip_amount,
        referral_pubkey,
        user_position_pda_bump,
    )?;

    /* MANUAL CPI (INTERACTIONS) */

    token_transfer.execute(vault)?;

    if let Some((metadata_program, position_metadata_account)) = with_metadata {
        mint_position_with_metadata(
            vault,
            user_position_nft_mint,
            user_position_nft_account,
            position_metadata_account,
            depositor,
            metadata_program,
            token_program,
            system_program,
            rent,
        )
    } else {
        mint_position_without_metadata(
            vault,
            user_position_nft_mint,
            user_position_nft_account,
            token_program,
        )
    }
}

pub fn mint_position_without_metadata<'info>(
    vault: &Account<'info, Vault>,
    mint: &Account<'info, Mint>,
    to: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
) -> Result<()> {
    mint_position_nft(vault, mint, to, token_program)?;

    revoke_position_nft_auth(token_program, vault, mint)?;

    Ok(())
}

pub fn mint_position_with_metadata<'info>(
    vault: &Account<'info, Vault>,
    mint: &Account<'info, Mint>,
    to: &Account<'info, TokenAccount>,

    position_metadata_account: &UncheckedAccount<'info>,
    funder: &Signer<'info>,
    metadata_program: &Program<'info, MetaplexTokenMetadata>,
    token_program: &Program<'info, Token>,
    system_program: &Program<'info, System>,
    rent: &Sysvar<'info, Rent>,
) -> Result<()> {
    mint_position_nft(vault, mint, to, token_program)?;

    invoke_signed(
        &create_metadata_accounts_v3(
            metadata_program.key(),
            position_metadata_account.key(),
            mint.key(),
            vault.key(),
            funder.key(),
            vault.key(),
            DRIP_METADATA_NAME.to_string(),
            DRIP_METADATA_SYMBOL.to_string(),
            get_metadata_url(&mint.key()),
            None,
            0,
            true,
            true,
            None,
            None,
            None,
        ),
        &[
            position_metadata_account.to_account_info(),
            mint.to_account_info(),
            vault.to_account_info(),
            vault.to_account_info(),
            funder.to_account_info(),
            metadata_program.to_account_info(),
            system_program.to_account_info(),
            rent.to_account_info(),
        ],
        &[sign!(vault)],
    )?;

    revoke_position_nft_auth(token_program, vault, mint)?;

    Ok(())
}

fn mint_position_nft<'info>(
    vault: &Account<'info, Vault>,
    mint: &Account<'info, Mint>,
    to: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
) -> Result<()> {
    // Mint NFT to user
    token::mint_to(
        CpiContext::new_with_signer(
            token_program.to_account_info().clone(),
            MintTo {
                mint: mint.to_account_info().clone(),
                to: to.to_account_info().clone(),
                authority: vault.to_account_info().clone(),
            },
            &[sign!(vault)],
        ),
        1,
    )?;

    Ok(())
}

fn revoke_position_nft_auth<'info>(
    token_program: &Program<'info, Token>,
    vault: &Account<'info, Vault>,
    mint: &Account<'info, Mint>,
) -> Result<()> {
    // Set the mint authority for this position NFT mint to None so that new tokens cannot be minted
    invoke_signed(
        &spl_token::instruction::set_authority(
            token_program.key,
            &mint.key(),
            None,
            AuthorityType::MintTokens,
            &vault.key(),
            &[&vault.key()],
        )?,
        &[
            mint.to_account_info(),
            vault.to_account_info(),
            token_program.to_account_info(),
        ],
        &[sign!(vault)],
    )?;

    Ok(())
}

#[derive(Clone)]
pub struct MetaplexTokenMetadata;

impl Id for MetaplexTokenMetadata {
    fn id() -> Pubkey {
        mpl_token_metadata::ID
    }
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositParams {
    pub token_a_deposit_amount: u64,
    pub number_of_swaps: u64,
}

// #[macro_export]
// macro_rules! deposit_ix {
//     ( $ix_name:ident {$($accounts:tt)*} ) => {
//         use anchor_spl::associated_token::AssociatedToken;
//         use crate::errors::ErrorCode;
//         use anchor_spl::token::{Mint};
//         use crate::state::{Position};
//         use crate::interactions::deposit_utils::{DepositParams};
//
//         #[derive(Accounts)]
//         #[instruction(params: DepositParams)]
//         pub struct $ix_name<'info> {
//             #[account(
//                 // mut needed
//                 mut,
//                 seeds = [
//                     b"drip-v1".as_ref(),
//                     token_a_mint.key().as_ref(),
//                     vault.token_b_mint.key().as_ref(),
//                     vault.proto_config.as_ref()
//                 ],
//                 bump = vault.bump
//             )]
//             pub vault: Box<Account<'info, Vault>>,
//
//             #[account(
//                 // mut needed because we are changing state
//                 mut,
//                 has_one = vault,
//                 seeds = [
//                     b"vault_period".as_ref(),
//                     vault.key().as_ref(),
//                     vault_period_end.period_id.to_string().as_bytes().as_ref()
//                 ],
//                 bump = vault_period_end.bump,
//                 constraint = {
//                     params.number_of_swaps > 0 &&
//                     vault_period_end.period_id > 0 &&
//                     vault_period_end.period_id == vault.last_drip_period.checked_add(params.number_of_swaps).unwrap()
//                 } @ErrorCode::InvalidVaultPeriod
//             )]
//             pub vault_period_end: Box<Account<'info, VaultPeriod>>,
//
//             #[account(
//                 init,
//                 space = Position::ACCOUNT_SPACE,
//                 seeds = [
//                     b"user_position".as_ref(),
//                     user_position_nft_mint.key().as_ref()
//                 ],
//                 bump,
//                 payer = depositor
//             )]
//             pub user_position: Box<Account<'info, Position>>,
//
//             // Token mints
//             #[account(
//                 constraint = token_a_mint.key() == vault.token_a_mint @ErrorCode::InvalidMint
//             )]
//             pub token_a_mint: Box<Account<'info, Mint>>,
//
//             #[account(
//                 init,
//                 mint::authority = vault,
//                 mint::decimals = 0,
//                 payer = depositor
//             )]
//             pub user_position_nft_mint: Box<Account<'info, Mint>>,
//
//             // Token accounts
//             #[account(
//                 // mut needed because we are changing balance
//                 mut,
//                 constraint = {
//                     vault_token_a_account.mint == vault.token_a_mint &&
//                     vault_token_a_account.owner == vault.key()
//                 },
//             )]
//             pub vault_token_a_account: Box<Account<'info, TokenAccount>>,
//
//             #[account(
//                 // mut needed because we are changing balance
//                 mut,
//                 constraint = {
//                     user_token_a_account.mint == vault.token_a_mint &&
//                     user_token_a_account.owner == depositor.key() &&
//                     user_token_a_account.delegate.contains(&vault.key()) &&
//                     params.token_a_deposit_amount > 0 &&
//                     user_token_a_account.delegated_amount >= params.token_a_deposit_amount
//                 }
//             )]
//             pub user_token_a_account: Box<Account<'info, TokenAccount>>,
//
//             #[account(
//                 init,
//                 associated_token::mint = user_position_nft_mint,
//                 associated_token::authority = depositor,
//                 payer = depositor
//             )]
//             pub user_position_nft_account: Box<Account<'info, TokenAccount>>,
//
//             // Other
//             // mut needed because we are initing accounts
//             #[account(mut)]
//             pub depositor: Signer<'info>,
//
//             pub token_program: Program<'info, Token>,
//             pub associated_token_program: Program<'info, AssociatedToken>,
//             pub rent: Sysvar<'info, Rent>,
//             pub system_program: Program<'info, System>,
//
//             $($accounts)*
//         }
//     };
//     ( $ix_name:ident ) => {
//         deposit_ix!($ix_name {});
//     };
// }
