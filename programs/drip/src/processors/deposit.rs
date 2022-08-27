use crate::errors::ErrorCode;
use crate::instructions::deposit::DepositParams;
use crate::interactions::transfer_token::TransferToken;
use crate::math::calculate_periodic_drip_amount;
use crate::sign;
use crate::state::traits::CPI;
use crate::state::traits::PDA;
use crate::state::{Position, Vault, VaultPeriod};
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
        &vault.to_account_info(),
        params.token_a_deposit_amount,
    );

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
        user_position_pda_bump,
    )?;

    /* MANUAL CPI (INTERACTIONS) */

    let signer: &Vault = vault;
    token_transfer.execute(signer)?;

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
    let signer: &Vault = vault;
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
        &[sign!(signer)],
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
