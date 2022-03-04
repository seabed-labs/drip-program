use crate::common::ErrorCode::WithdrawableAmountIsZero;
use crate::math::calculate_withdraw_token_b_amount;
use crate::sign;
use crate::state::{Position, Vault, VaultPeriod};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
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
    pub vault_token_b_account: Account<'info, TokenAccount>,

    #[account(
        constraint = {
            vault_token_b_mint.key() == vault.token_b_mint &&
            vault_token_b_mint.is_initialized
        }
    )]
    pub vault_token_b_mint: Account<'info, Mint>,

    #[account(
        constraint = {
            user_token_b_account.mint == vault.token_b_mint &&
            user_token_b_account.owner == withdrawer.key() &&
            user_token_b_account.state == AccountState::Initialized
        }
    )]
    pub user_token_b_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdrawer: Signer<'info>,
    #[account(address = Token::id())]
    pub token_program: Program<'info, Token>,
    #[account(address = anchor_spl::associated_token::ID)]
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<WithdrawB>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let user_position = &mut ctx.accounts.user_position;
    let period_i = &ctx.accounts.vault_period_i;
    let period_j = &ctx.accounts.vault_period_j;

    let max_withdrawable_amount = calculate_withdraw_token_b_amount(
        user_position.dca_period_id_before_deposit,
        vault.last_dca_period,
        period_i.twap,
        period_j.twap,
        user_position.periodic_drip_amount,
    );

    let withdrawable_amount = max_withdrawable_amount
        .checked_sub(user_position.withdrawn_token_b_amount)
        .unwrap();
    user_position.withdrawn_token_b_amount = user_position
        .withdrawn_token_b_amount
        .checked_add(withdrawable_amount)
        .unwrap();

    if withdrawable_amount == 0 {
        return Err(WithdrawableAmountIsZero.into());
    }

    send_tokens(
        &ctx.accounts.token_program,
        vault,
        &ctx.accounts.vault_token_b_account,
        &ctx.accounts.user_token_b_account,
        withdrawable_amount,
    )?;

    // TODO: Maybe add more metadata to this log?
    msg!("Withdraw B IX Successful");

    Ok(())
}

fn send_tokens<'info>(
    token_program: &Program<'info, Token>,
    vault: &mut Account<'info, Vault>,
    from: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    amount: u64,
) -> Result<()> {
    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info().clone(),
            Transfer {
                from: from.to_account_info().clone(),
                to: to.to_account_info().clone(),
                authority: vault.to_account_info().clone(),
            },
            &[sign!(vault)],
        ),
        amount,
    )
}
