use crate::errors::ErrorCode;
use crate::interactions::transfer_token::TransferToken;
use crate::math::{
    calculate_spread_amount, calculate_withdraw_token_a_amount, calculate_withdraw_token_b_amount,
};
use crate::state::{Position, Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_lang::System;
use anchor_spl::token::{burn, Burn, Mint, Token, TokenAccount};
use spl_token::state::AccountState;

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    /* DCAF ACCOUNTS */
    #[account(
        // mut neeed
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
        constraint = vault_proto_config.key() == vault.proto_config
    )]
    pub vault_proto_config: Box<Account<'info, VaultProtoConfig>>,

    #[account(
        has_one = vault,
        seeds = [
            b"vault_period".as_ref(),
            vault_period_i.vault.as_ref(),
            vault_period_i.period_id.to_string().as_bytes().as_ref(),
        ],
        bump = vault_period_i.bump,
        constraint = vault_period_i.period_id == user_position.dca_period_id_before_deposit,
        constraint = vault_period_i.vault == vault.key()
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
        constraint = vault_period_j.period_id == std::cmp::min(
            vault.last_dca_period,
            user_position.dca_period_id_before_deposit
                .checked_add(user_position.number_of_swaps)
                .unwrap()
            ),
        constraint = vault_period_j.vault == vault.key()
    )]
    pub vault_period_j: Box<Account<'info, VaultPeriod>>,

    #[account(
        // mut neeed because we are changing state
        mut,
        has_one = vault,
        seeds = [
            b"vault_period".as_ref(),
            vault_period_user_expiry.vault.as_ref(),
            vault_period_user_expiry.period_id.to_string().as_bytes().as_ref(),
        ],
        bump = vault_period_user_expiry.bump,
        constraint = vault_period_user_expiry.period_id == user_position.dca_period_id_before_deposit
                                                .checked_add(user_position.number_of_swaps)
                                                .unwrap(),
        constraint = vault_period_user_expiry.vault == vault.key()
    )]
    pub vault_period_user_expiry: Box<Account<'info, VaultPeriod>>,

    #[account(
        // mut neeed because we are changing state
        mut,
        has_one = vault,
        seeds = [
            b"user_position".as_ref(),
            user_position.position_authority.as_ref()
        ],
        bump = user_position.bump,
        constraint = !user_position.is_closed,
        constraint = user_position.position_authority == user_position_nft_mint.key(),
        constraint = user_position.vault == vault.key()
    )]
    pub user_position: Box<Account<'info, Position>>,

    /* TOKEN ACCOUNTS */
    #[account(
        // mut neeed because we are changing balance
        mut,
        associated_token::mint = token_a_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut neeed because we are changing balance
        mut,
        associated_token::mint = token_b_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut neeed because we are changing balance
        mut,
        constraint = vault_treasury_token_b_account.key() == vault.treasury_token_b_account,
        constraint = vault_treasury_token_b_account.mint == vault.token_b_mint @ErrorCode::InvalidMint,
        constraint = vault_treasury_token_b_account.state == AccountState::Initialized
    )]
    pub vault_treasury_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut neeed because we are changing balance
        mut,
        constraint = user_token_b_account.mint == vault.token_b_mint @ErrorCode::InvalidMint,
        constraint = user_token_b_account.owner == withdrawer.key(),
        constraint = user_token_b_account.state == AccountState::Initialized
    )]
    pub user_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut neeed because we are changing balance
        mut,
        constraint = user_token_a_account.mint == vault.token_a_mint @ErrorCode::InvalidMint,
        constraint = user_token_a_account.owner == withdrawer.key(),
        constraint = user_token_a_account.state == AccountState::Initialized
    )]
    pub user_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut neeed because we are changing balance
        mut,
        constraint = user_position_nft_account.mint == user_position.position_authority @ErrorCode::InvalidMint,
        constraint = user_position_nft_account.owner == withdrawer.key(),
        constraint = user_position_nft_account.state == AccountState::Initialized,
        constraint = user_position_nft_account.amount == 1,
        constraint = user_position_nft_account.delegate.contains(&vault.key()),
        constraint = user_position_nft_account.delegated_amount == 1
    )]
    pub user_position_nft_account: Box<Account<'info, TokenAccount>>,

    /* MINTS */
    #[account(
        // mut neeed because we are burning the users NFT
        mut,
        constraint = user_position_nft_mint.key() == user_position.position_authority @ErrorCode::InvalidMint,
        constraint = user_position_nft_mint.supply == 1,
        constraint = user_position_nft_mint.decimals == 0,
        constraint = user_position_nft_mint.is_initialized == true,
        constraint = user_position_nft_mint.mint_authority.is_none()
    )]
    pub user_position_nft_mint: Box<Account<'info, Mint>>,

    #[account(
        constraint = token_a_mint.key() == vault.token_a_mint @ErrorCode::InvalidMint,
        constraint = token_a_mint.is_initialized
    )]
    pub token_a_mint: Box<Account<'info, Mint>>,

    #[account(
        constraint = token_b_mint.key() == vault.token_b_mint @ErrorCode::InvalidMint,
        constraint = token_b_mint.is_initialized
    )]
    pub token_b_mint: Box<Account<'info, Mint>>,

    /* MISC */
    pub withdrawer: Signer<'info>,

    #[account(address = Token::id())]
    pub token_program: Program<'info, Token>,

    #[account(address = System::id())]
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClosePosition>) -> Result<()> {
    /* MANUAL CHECKS + COMPUTE (CHECKS) */

    // 1. Get max withdrawable Token A and Token B for this position
    let i = ctx.accounts.vault_period_i.period_id;
    let j = ctx.accounts.vault_period_j.period_id;
    let withdrawable_amount_a = calculate_withdraw_token_a_amount(
        i,
        j,
        ctx.accounts.user_position.number_of_swaps,
        ctx.accounts.user_position.periodic_drip_amount,
    );
    let max_withdrawable_amount_b = calculate_withdraw_token_b_amount(
        i,
        j,
        ctx.accounts.vault_period_i.twap,
        ctx.accounts.vault_period_j.twap,
        ctx.accounts.user_position.periodic_drip_amount,
        ctx.accounts.vault_proto_config.trigger_dca_spread,
    );
    let withdrawable_amount_b_before_fees = ctx
        .accounts
        .user_position
        .get_withdrawable_amount_with_max(max_withdrawable_amount_b);

    // 2. Account for Withdrawal Spread on Token B
    let withdrawal_spread_amount_b = calculate_spread_amount(
        withdrawable_amount_b_before_fees,
        ctx.accounts.vault_proto_config.base_withdrawal_spread,
    );
    let withdrawable_amount_b = withdrawable_amount_b_before_fees
        .checked_sub(withdrawal_spread_amount_b)
        .unwrap();

    // 3. Transfer tokens (these are lazily executed below)
    let transfer_a_to_user = if withdrawable_amount_a == 0 {
        None
    } else {
        Some(TransferToken::new(
            &ctx.accounts.token_program,
            &ctx.accounts.vault_token_a_account,
            &ctx.accounts.user_token_a_account,
            withdrawable_amount_a,
        ))
    };

    let transfer_b_to_user = if withdrawable_amount_b == 0 {
        None
    } else {
        Some(TransferToken::new(
            &ctx.accounts.token_program,
            &ctx.accounts.vault_token_b_account,
            &ctx.accounts.user_token_b_account,
            withdrawable_amount_b,
        ))
    };

    let transfer_b_to_treasury = if withdrawal_spread_amount_b == 0 {
        None
    } else {
        Some(TransferToken::new(
            &ctx.accounts.token_program,
            &ctx.accounts.vault_token_b_account,
            &ctx.accounts.vault_treasury_token_b_account,
            withdrawal_spread_amount_b,
        ))
    };
    /* STATE UPDATES (EFFECTS) */

    // 4. update user position, withdrawn amount, drip_amount and dar
    ctx.accounts.user_position.close();
    ctx.accounts
        .user_position
        .increase_withdrawn_amount(withdrawable_amount_b_before_fees);

    // Only reduce drip amount and dar if we haven't done so already
    if ctx.accounts.vault_period_j.period_id < ctx.accounts.vault_period_user_expiry.period_id {
        ctx.accounts
            .vault
            .decrease_drip_amount(ctx.accounts.user_position.periodic_drip_amount);
        ctx.accounts
            .vault_period_user_expiry
            .decrease_drip_amount_to_reduce(ctx.accounts.user_position.periodic_drip_amount);
    }

    /* MANUAL CPI (INTERACTIONS) */

    // 5. Invoke the token transfer IX's
    if let Some(transfer) = transfer_a_to_user {
        transfer.execute(&ctx.accounts.vault)?;
    }
    if let Some(transfer) = transfer_b_to_user {
        transfer.execute(&ctx.accounts.vault)?;
    }
    if let Some(transfer) = transfer_b_to_treasury {
        transfer.execute(&ctx.accounts.vault)?;
    }

    // 6. Burn the users position NFT
    burn_tokens(
        &ctx.accounts.token_program,
        &mut ctx.accounts.vault,
        &ctx.accounts.user_position_nft_mint,
        &ctx.accounts.user_position_nft_account,
        1,
    )?;

    Ok(())
}

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
