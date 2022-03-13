use crate::errors::ErrorCode;
use crate::interactions::transfer_token::TransferToken;
use crate::math::calculate_withdraw_token_b_amount;
use crate::state::{Position, Vault, VaultPeriod};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use spl_token::state::AccountState;

// TODO(matcha): Make sure the NFT account supply is one always

#[derive(Accounts)]
pub struct WithdrawB<'info> {
    #[account(
        mut,
        seeds = [
            b"dca-vault-v1".as_ref(),
            vault.token_a_mint.as_ref(),
            vault.token_b_mint.as_ref(),
            vault.proto_config.as_ref()
        ],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        has_one = vault,
        seeds = [
            b"vault_period".as_ref(),
            vault_period_i.vault.as_ref(),
            vault_period_i.period_id.to_string().as_bytes().as_ref(),
        ],
        bump = vault_period_i.bump,
        constraint = {
            vault_period_i.period_id == user_position.dca_period_id_before_deposit
        }
    )]
    pub vault_period_i: Account<'info, VaultPeriod>,

    #[account(
        has_one = vault,
        seeds = [
            b"vault_period".as_ref(),
            vault_period_j.vault.as_ref(),
            vault_period_j.period_id.to_string().as_bytes().as_ref(),
        ],
        bump = vault_period_j.bump,
        constraint = {
            vault_period_j.period_id == std::cmp::min(
                vault.last_dca_period,
                user_position.dca_period_id_before_deposit.checked_add(user_position.number_of_swaps).unwrap()
            )
        }
    )]
    pub vault_period_j: Account<'info, VaultPeriod>,

    // TODO(matcha) | TODO(mocha): Ensure that there's no way for user to exploit the accounts
    // passed in here to steal funds that do not belong to them by faking accounts
    // Pre-requisite to ^: Ensure that users can't pass in a constructed PDA
    #[account(
        mut,
        has_one = vault,
        seeds = [
            b"user_position".as_ref(),
            user_position.vault.as_ref(),
            user_position.position_authority.as_ref()
        ],
        bump = user_position.bump,
        constraint = {
            user_position.position_authority == user_position_nft_account.mint &&
            !user_position.is_closed
        }
    )]
    pub user_position: Account<'info, Position>,

    #[account(
        constraint = {
            user_position_nft_account.mint == user_position.position_authority &&
            user_position_nft_account.owner == withdrawer.key() &&
            user_position_nft_account.amount == 1 &&
            user_position_nft_account.state == AccountState::Initialized
        }
    )]
    pub user_position_nft_account: Account<'info, TokenAccount>,

    #[account(
        constraint = {
            user_position_nft_mint.supply == 1 &&
            user_position_nft_mint.mint_authority.is_none() &&
            user_position_nft_mint.decimals == 0 &&
            user_position_nft_mint.is_initialized &&
            user_position_nft_mint.freeze_authority.is_none()
        }
    )]
    pub user_position_nft_mint: Account<'info, Mint>,

    // TODO(matcha): Make sure this actually verifies that its an ATA
    // TODO(matcha): ALSO, make sure that this ATA verification happens in other places where an ATA is passed in
    #[account(
        mut,
        associated_token::mint = vault_token_b_mint,
        associated_token::authority = vault,
        // TODO: Add integration test to verify that this ATA check actually works
    )]
    pub vault_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        constraint = {
            vault_token_b_mint.key() == vault.token_b_mint &&
            vault_token_b_mint.is_initialized
        }
    )]
    pub vault_token_b_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = {
            user_token_b_account.mint == vault.token_b_mint &&
            user_token_b_account.owner == withdrawer.key() &&
            user_token_b_account.state == AccountState::Initialized
        }
    )]
    pub user_token_b_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub withdrawer: Signer<'info>,
    #[account(address = Token::id())]
    pub token_program: Program<'info, Token>,
    #[account(address = anchor_spl::associated_token::ID)]
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<WithdrawB>) -> Result<()> {
    /* MANUAL CHECKS + COMPUTE (CHECKS) */

    // 1. Get max withdrawable Token B amount for this user
    let max_withdrawable_amount = calculate_withdraw_token_b_amount(
        ctx.accounts.vault_period_i.period_id,
        ctx.accounts.vault_period_j.period_id,
        ctx.accounts.vault_period_i.twap,
        ctx.accounts.vault_period_j.twap,
        ctx.accounts.user_position.periodic_drip_amount,
    );

    // 2. Compute withdrawable amount (since they could have withdrawn some already)
    let withdrawable_amount = ctx
        .accounts
        .user_position
        .get_withdrawable_amount(max_withdrawable_amount);

    // 3. No point in completing IX if there's nothing happening
    if withdrawable_amount == 0 {
        return Err(ErrorCode::WithdrawableAmountIsZero.into());
    }

    // 4. Transfer tokens user wants to withdraw (this is lazily executed below)
    let token_transfer = TransferToken::new(
        &ctx.accounts.token_program,
        &ctx.accounts.vault_token_b_account,
        &ctx.accounts.user_token_b_account,
        withdrawable_amount,
    );

    /* STATE UPDATES (EFFECTS) */

    // 5. Update the user's position state to reflect the newly withdrawn amount
    ctx.accounts
        .user_position
        .update_withdrawn_amount(withdrawable_amount);

    /* MANUAL CPI (INTERACTIONS) */

    // 6. Invoke the token transfer IX
    token_transfer.execute(&ctx.accounts.vault)?;

    Ok(())
}
