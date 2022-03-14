use crate::math::{calculate_withdraw_token_a_amount, calculate_withdraw_token_b_amount};
use crate::state::{Position, Vault, VaultPeriod};
use anchor_lang::prelude::*;
use anchor_lang::System;
use anchor_spl::token::{burn, transfer, Burn, Mint, Token, TokenAccount, Transfer};
use spl_token::state::AccountState;

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    // Dcaf accounts
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
    pub vault: Box<Account<'info, Vault>>,

    #[account(
        has_one = vault,
        seeds = [
            b"vault_period".as_ref(),
            vault_period_i.vault.as_ref(),
            vault_period_i.period_id.to_string().as_bytes().as_ref(),
        ],
        bump = vault_period_i.bump,
        constraint = {
            vault_period_i.period_id == user_position.dca_period_id_before_deposit &&
            vault_period_i.vault == vault.key()
        }
    )]
    pub vault_period_i: Box<Account<'info, VaultPeriod>>,

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
                user_position.dca_period_id_before_deposit
                    .checked_add(user_position.number_of_swaps)
                    .unwrap()
            ) &&
            vault_period_j.vault == vault.key()
        }
    )]
    pub vault_period_j: Box<Account<'info, VaultPeriod>>,

    #[account(
        mut,
        has_one = vault,
        seeds = [
            b"vault_period".as_ref(),
            vault_period_user_expiry.vault.as_ref(),
            vault_period_user_expiry.period_id.to_string().as_bytes().as_ref(),
        ],
        bump = vault_period_user_expiry.bump,
        constraint = {
            vault_period_user_expiry.period_id == user_position.dca_period_id_before_deposit
                                                    .checked_add(user_position.number_of_swaps)
                                                    .unwrap() &&
            vault_period_user_expiry.vault == vault.key()
        }
    )]
    pub vault_period_user_expiry: Box<Account<'info, VaultPeriod>>,

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
            !user_position.is_closed &&
            user_position.position_authority == user_position_nft_mint.key() &&
            user_position.vault == vault.key()
        }
    )]
    pub user_position: Box<Account<'info, Position>>,

    // Token Accounts
    #[account(
        mut,
        associated_token::mint = token_a_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = token_b_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = {
            user_token_a_account.mint == vault.token_a_mint &&
            user_token_a_account.owner == withdrawer.key() &&
            user_token_a_account.state == AccountState::Initialized
        }
    )]
    pub user_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = {
            user_token_b_account.mint == vault.token_b_mint &&
            user_token_b_account.owner == withdrawer.key() &&
            user_token_b_account.state == AccountState::Initialized
        }
    )]
    pub user_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = {
            user_position_nft_account.mint == user_position.position_authority &&
            user_position_nft_account.owner == withdrawer.key() &&
            user_position_nft_account.state == AccountState::Initialized &&
            user_position_nft_account.amount == 1 &&
            user_position_nft_account.delegate.contains(&vault.key()) &&
            user_position_nft_account.delegated_amount == 1
        }
    )]
    pub user_position_nft_account: Box<Account<'info, TokenAccount>>,

    // Mints
    #[account(
        // mut neeed because we are burning the users NFT
        mut,
        constraint = {
            user_position_nft_mint.key() == user_position.position_authority &&
            user_position_nft_mint.supply == 1 &&
            user_position_nft_mint.decimals == 0 &&
            user_position_nft_mint.is_initialized == true &&
            user_position_nft_mint.mint_authority.is_none()
        }
    )]
    pub user_position_nft_mint: Box<Account<'info, Mint>>,

    #[account(
        constraint = {
            token_a_mint.key() == vault.token_a_mint &&
            token_a_mint.is_initialized
        }
    )]
    pub token_a_mint: Box<Account<'info, Mint>>,

    #[account(
        constraint = token_b_mint.key() == vault.token_b_mint &&
        token_b_mint.is_initialized
    )]
    pub token_b_mint: Box<Account<'info, Mint>>,

    // Other
    #[account(mut)]
    pub withdrawer: Signer<'info>,

    #[account(address = Token::id())]
    pub token_program: Program<'info, Token>,
    #[account(address = System::id())]
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClosePosition>) -> Result<()> {
    // Update state
    let user_position = &mut ctx.accounts.user_position;
    user_position.is_closed = true;

    let i = ctx.accounts.vault_period_i.period_id;
    let j = ctx.accounts.vault_period_j.period_id;

    let withdraw_a = calculate_withdraw_token_a_amount(
        i,
        j,
        ctx.accounts.user_position.number_of_swaps,
        ctx.accounts.user_position.periodic_drip_amount,
    );

    let max_withdrawable_b = calculate_withdraw_token_b_amount(
        i,
        j,
        ctx.accounts.vault_period_i.twap,
        ctx.accounts.vault_period_j.twap,
        ctx.accounts.user_position.periodic_drip_amount,
    );
    let withdraw_b = max_withdrawable_b
        .checked_sub(ctx.accounts.user_position.withdrawn_token_b_amount)
        .unwrap();

    let user_position = &mut ctx.accounts.user_position;
    user_position.withdrawn_token_b_amount = user_position
        .withdrawn_token_b_amount
        .checked_add(withdraw_b)
        .unwrap();

    // Only reduce drip amount and dar if we haven't done so already
    if ctx.accounts.vault_period_j.period_id < ctx.accounts.vault_period_user_expiry.period_id {
        let vault = &mut ctx.accounts.vault;
        vault.drip_amount = vault
            .drip_amount
            .checked_sub(ctx.accounts.user_position.periodic_drip_amount)
            .unwrap();

        let vault_period_user_expiry = &mut ctx.accounts.vault_period_user_expiry;
        vault_period_user_expiry.dar = vault_period_user_expiry
            .dar
            .checked_sub(ctx.accounts.user_position.periodic_drip_amount)
            .unwrap();
    }

    // transfer A, B and close position
    if withdraw_a != 0 {
        send_tokens(
            &ctx.accounts.token_program,
            &mut ctx.accounts.vault,
            &ctx.accounts.vault_token_a_account,
            &ctx.accounts.user_token_a_account,
            withdraw_a,
        )?;
    }

    if withdraw_b != 0 {
        send_tokens(
            &ctx.accounts.token_program,
            &mut ctx.accounts.vault,
            &ctx.accounts.vault_token_b_account,
            &ctx.accounts.user_token_b_account,
            withdraw_b,
        )?;
    }

    burn_tokens(
        &ctx.accounts.token_program,
        &mut ctx.accounts.vault,
        &ctx.accounts.user_position_nft_mint,
        &ctx.accounts.user_position_nft_account,
        1,
    )?;

    Ok(())
}

// TODO(mocha) | TODO(matcha): de-dupe this fn to a common file
fn send_tokens<'info>(
    token_program: &Program<'info, Token>,
    vault: &mut Account<'info, Vault>,
    from: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    amount: u64,
) -> Result<()> {
    transfer(
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

// TODO(mocha) | TODO(matcha): move to common file
fn burn_tokens<'info>(
    token_program: &Program<'info, Token>,
    vault: &mut Account<'info, Vault>,
    mint: &Account<'info, Mint>,
    to: &Account<'info, TokenAccount>,
    amount: u64,
) -> Result<()> {
    burn(
        CpiContext::new_with_signer(
            token_program.to_account_info().clone(),
            Burn {
                mint: mint.to_account_info().clone(),
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
