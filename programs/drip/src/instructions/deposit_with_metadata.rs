use crate::errors::ErrorCode::PeriodicDripAmountIsZero;
use crate::interactions::deposit::mint_position_with_metadata;
use crate::interactions::transfer_token::TransferToken;
use crate::math::calculate_periodic_drip_amount;
use crate::state::{Position, Vault, VaultPeriod};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use super::deposit::DepositParams;

#[derive(Accounts)]
#[instruction(params: DepositParams)]
pub struct DepositWithMetadata<'info> {
    // TODO(matcha): Move other IX's vault validation to self-contained like this instead of passing in mints and proto config just to validate vault
    #[account(
        // mut needed
        mut,
        seeds = [
            b"drip-v1".as_ref(),
            vault.token_a_mint.as_ref(),
            vault.token_b_mint.as_ref(),
            vault.proto_config.as_ref()
        ],
        bump = vault.bump
    )]
    pub vault: Box<Account<'info, Vault>>,

    // TODO(matcha): Maybe move the constraint here to the handler and throw a custom error
    // TODO(matcha): Add PDA seed validation here
    #[account(
        // mut needed because we are changing state
        mut,
        has_one = vault,
        constraint = {
            params.number_of_swaps > 0 &&
            vault_period_end.period_id > 0 &&
            vault_period_end.period_id == vault.last_drip_period.checked_add(params.number_of_swaps).unwrap()
        }
    )]
    pub vault_period_end: Box<Account<'info, VaultPeriod>>,

    #[account(
        init,
        space = Position::ACCOUNT_SPACE,
        seeds = [
            b"user_position".as_ref(),
            user_position_nft_mint.key().as_ref()
        ],
        bump,
        payer = depositor
    )]
    pub user_position: Box<Account<'info, Position>>,

    // Token mints
    #[account(
        constraint = {
            token_a_mint.key() == vault.token_a_mint
        },
    )]
    pub token_a_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        mint::authority = vault,
        mint::decimals = 0,
        payer = depositor
    )]
    pub user_position_nft_mint: Box<Account<'info, Mint>>,

    // TODO(matcha): Verify that this is an ATA (and all other places too)
    // Token accounts
    #[account(
        // mut neeed because we are changing balance
        mut,
        constraint = {
            vault_token_a_account.mint == vault.token_a_mint &&
            vault_token_a_account.owner == vault.key()
        },
    )]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    // TODO(matcha): Revisit this and make sure this constraint makes sense
    #[account(
        // mut neeed because we are changing balance
        mut,
        constraint = {
            user_token_a_account.mint == vault.token_a_mint &&
            user_token_a_account.owner == depositor.key() &&
            user_token_a_account.delegate.contains(&vault.key()) &&
            user_token_a_account.delegated_amount == params.token_a_deposit_amount &&
            params.token_a_deposit_amount > 0
        }
    )]
    pub user_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        associated_token::mint = user_position_nft_mint,
        associated_token::authority = depositor,
        payer = depositor
    )]
    pub user_position_nft_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: checked via the Metadata CPI call
    /// https://github.com/metaplex-foundation/metaplex-program-library/blob/master/token-metadata/program/src/utils.rs#L873
    #[account(mut)]
    pub position_metadata_account: UncheckedAccount<'info>,

    // Other
    // mut neeed because we are initing accounts
    #[account(mut)]
    pub depositor: Signer<'info>,

    /// CHECK: checked via account constraints
    #[account(address = mpl_token_metadata::ID)]
    pub metadata_program: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositWithMetadata>, params: DepositParams) -> Result<()> {
    // TODO(matcha): Do validations that are not possible via eDSL
    /* MANUAL CHECKS + COMPUTE (CHECKS) */

    let periodic_drip_amount =
        calculate_periodic_drip_amount(params.token_a_deposit_amount, params.number_of_swaps);

    if periodic_drip_amount == 0 {
        return Err(PeriodicDripAmountIsZero.into());
    }

    let token_transfer = TransferToken::new(
        &ctx.accounts.token_program,
        &ctx.accounts.user_token_a_account,
        &ctx.accounts.vault_token_a_account,
        params.token_a_deposit_amount,
    );

    /* STATE UPDATES (EFFECTS) */

    let vault_mut = &mut ctx.accounts.vault;
    let vault_period_end_mut = &mut ctx.accounts.vault_period_end;
    let position_mut = &mut ctx.accounts.user_position;

    vault_mut.increase_drip_amount(periodic_drip_amount);
    vault_period_end_mut.increase_drip_amount_to_reduce(periodic_drip_amount);
    position_mut.init(
        ctx.accounts.vault.key(),
        ctx.accounts.user_position_nft_mint.key(),
        params.token_a_deposit_amount,
        ctx.accounts.vault.last_drip_period,
        params.number_of_swaps,
        periodic_drip_amount,
        ctx.bumps.get("user_position"),
    )?;

    /* MANUAL CPI (INTERACTIONS) */

    token_transfer.execute(&ctx.accounts.vault)?;

    mint_position_with_metadata(
        &ctx.accounts.vault,
        &ctx.accounts.user_position_nft_mint,
        &ctx.accounts.user_position_nft_account,
        &ctx.accounts.position_metadata_account,
        &ctx.accounts.depositor,
        &ctx.accounts.metadata_program,
        &ctx.accounts.token_program,
        &ctx.accounts.system_program,
        &ctx.accounts.rent,
    )?;

    Ok(())
}
