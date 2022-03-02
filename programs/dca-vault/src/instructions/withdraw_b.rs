use crate::math::calculate_withdraw_token_b_amount;
use crate::state::{Position, Vault, VaultPeriod};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};

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
            vault.key().as_ref(),
            dca_period_predeposit.period_id.to_string().as_bytes().as_ref(),
        ],
        bump = dca_period_predeposit.bump,
        constraint = dca_period_predeposit.period_id == user_position.dca_period_id_before_deposit
    )]
    pub dca_period_predeposit: Account<'info, VaultPeriod>,

    #[account(
        has_one = vault,
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            dca_period_latest.period_id.to_string().as_bytes().as_ref(),
        ],
        bump = dca_period_latest.bump,
        constraint = {
            dca_period_latest.period_id == std::cmp::min(
                vault.last_dca_period,
                user_position.dca_period_id_before_deposit + user_position.number_of_swaps
            )
        }
    )]
    pub dca_period_latest: Account<'info, VaultPeriod>,

    // TODO(matcha) | TODO(mocha): Ensure that there's no way for user to exploit the accounts
    // passed in here to steal funds that do not belong to them by faking accounts
    // Pre-requisite to ^: Ensure that users can't pass in a constructed PDA
    #[account(
        has_one = vault,
        seeds = [
            b"user_position".as_ref(),
            vault.key().as_ref(),
            user_position_nft_account.mint.as_ref()
        ],
        bump = user_position.bump,
        constraint = {
            user_position.position_authority == user_position_nft_account.mint &&
            !user_position.is_closed
            // TODO(matcha): Make sure to validate that they're not trying to withdraw more than they are eligible for
            // Eligibility is computed as = withdrawable_b - already_withdrawn_b
        }
    )]
    pub user_position: Account<'info, Position>,

    #[account(
        constraint = {
            user_position_nft_account.mint == user_position.position_authority &&
            user_position_nft_account.owner == user.key() &&
            user_position_nft_account.amount == 1
        }
    )]
    pub user_position_nft_account: Account<'info, TokenAccount>,

    // TODO(mathca): Make sure this actually verifies that its an ATA
    // TODO(matcha): ALSO, make sure that this ATA verification happens in other places where an ATA is passed in
    #[account(
        mut,
        associated_token::mint = vault_token_b_mint,
        associated_token::authority = vault,
        // TODO: Add constraints here if the ATA stuff doesn't work including seed checks?
    )]
    pub vault_token_b_account: Account<'info, TokenAccount>,

    #[account(
        constraint = vault_token_b_mint.key() == vault.token_b_mint
    )]
    pub vault_token_b_mint: Account<'info, Mint>,

    #[account(
        constraint = user_token_b_account.owner == user.key()
    )]
    pub user_token_b_account: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    #[account(address = Token::id())]
    pub token_program: Program<'info, Token>,
    #[account(address = anchor_spl::associated_token::ID)]
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<WithdrawB>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let user_position = &mut ctx.accounts.user_position;
    let period_i = &ctx.accounts.dca_period_predeposit;
    let period_j = &ctx.accounts.dca_period_latest;

    let max_withdrawable_amount = calculate_withdraw_token_b_amount(
        user_position.dca_period_id_before_deposit,
        vault.last_dca_period,
        period_i.twap,
        period_j.twap,
        user_position.periodic_drip_amount,
    );

    let withdrawable_amount = max_withdrawable_amount - user_position.withdrawn_token_b_amount;

    send_tokens(
        &ctx.accounts.token_program,
        vault,
        &ctx.accounts.vault_token_b_account,
        &ctx.accounts.user_token_b_account,
        withdrawable_amount,
    )?;

    user_position.withdrawn_token_b_amount += withdrawable_amount;

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
            &[&[
                b"dca-vault-v1".as_ref(),
                vault.token_a_mint.as_ref(),
                vault.token_b_mint.as_ref(),
                vault.proto_config.as_ref(),
                &[vault.bump],
            ]],
        ),
        amount,
    )
}
