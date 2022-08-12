use crate::errors::ErrorCode;
use crate::interactions::transfer_token::TransferToken;
use crate::math::{calculate_spread_amount, calculate_withdraw_token_b_amount};
use crate::state::{Position, Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct WithdrawB<'info> {
    /* DRIP ACCOUNTS */
    #[account(
        seeds = [
            b"drip-v1".as_ref(),
            vault.token_a_mint.as_ref(),
            token_b_mint.key().as_ref(),
            vault_proto_config.key().as_ref()
        ],
        bump = vault.bump
    )]
    pub vault: Box<Account<'info, Vault>>,

    #[account(
        constraint = vault_proto_config.key() == vault.proto_config @ErrorCode::InvalidVaultProtoConfigReference
    )]
    pub vault_proto_config: Box<Account<'info, VaultProtoConfig>>,

    #[account(
        has_one = vault,
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            vault_period_i.period_id.to_string().as_bytes().as_ref(),
        ],
        bump = vault_period_i.bump,
        constraint = vault_period_i.period_id == user_position.drip_period_id_before_deposit @ErrorCode::InvalidVaultPeriod,
    )]
    pub vault_period_i: Account<'info, VaultPeriod>,

    #[account(
        has_one = vault,
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            vault_period_j.period_id.to_string().as_bytes().as_ref(),
        ],
        bump = vault_period_j.bump,
        constraint = vault_period_j.period_id == std::cmp::min(
            vault.last_drip_period,
            user_position.drip_period_id_before_deposit.checked_add(user_position.number_of_swaps).unwrap()
        ) @ErrorCode::InvalidVaultPeriod,
    )]
    pub vault_period_j: Account<'info, VaultPeriod>,

    #[account(
        // mut needed because we are updating withdrawn amount
        mut,
        has_one = vault,
        seeds = [
            b"user_position".as_ref(),
            user_position_nft_mint.key().as_ref()
        ],
        bump = user_position.bump,
        constraint = user_position.position_authority == user_position_nft_mint.key() @ErrorCode::InvalidMint,
        constraint = !user_position.is_closed @ErrorCode::PositionAlreadyClosed,
    )]
    pub user_position: Account<'info, Position>,

    /* TOKEN ACCOUNTS */
    #[account(
        constraint = user_position_nft_account.mint == user_position_nft_mint.key() @ErrorCode::InvalidMint,
        constraint = user_position_nft_account.owner == withdrawer.key(),
        constraint = user_position_nft_account.amount == 1,
    )]
    pub user_position_nft_account: Account<'info, TokenAccount>,

    #[account(
        // mut needed because we are changing the balance
        mut,
        constraint = vault_token_b_account.owner == vault.key(),
        constraint = vault_token_b_account.mint == token_b_mint.key() @ErrorCode::InvalidMint,
        constraint = vault_token_b_account.key() == vault.token_b_account,
    )]
    pub vault_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing the balance
        mut,
        constraint = user_token_b_account.owner == withdrawer.key(),
        constraint = user_token_b_account.mint == token_b_mint.key() @ ErrorCode::InvalidMint,
    )]
    pub user_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = vault_treasury_token_b_account.key() == vault.treasury_token_b_account,
        constraint = vault_token_b_account.owner == vault.key(),
        constraint = vault_treasury_token_b_account.mint == token_b_mint.key() @ErrorCode::InvalidMint,
    )]
    pub vault_treasury_token_b_account: Box<Account<'info, TokenAccount>>,

    /* MINTS */
    #[account(
        constraint = user_position_nft_mint.supply == 1,
        constraint = user_position_nft_mint.key() == user_position.position_authority @ErrorCode::InvalidMint,
        constraint = user_position_nft_mint.mint_authority.is_none(),
        constraint = user_position_nft_mint.decimals == 0,
        constraint = user_position_nft_mint.is_initialized,
        constraint = user_position_nft_mint.freeze_authority.is_none()
    )]
    pub user_position_nft_mint: Account<'info, Mint>,

    #[account(
        constraint = token_b_mint.key() == vault.token_b_mint @ErrorCode::InvalidMint,
        constraint = token_b_mint.is_initialized
    )]
    pub token_b_mint: Box<Account<'info, Mint>>,

    /* MISC */
    pub withdrawer: Signer<'info>,

    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<WithdrawB>) -> Result<()> {
    /* MANUAL CHECKS + COMPUTE (CHECKS) */

    // 1. Get max withdrawable Token B amount for this user
    let max_withdrawable_amount_b = calculate_withdraw_token_b_amount(
        ctx.accounts.vault_period_i.period_id,
        ctx.accounts.vault_period_j.period_id,
        ctx.accounts.vault_period_i.twap,
        ctx.accounts.vault_period_j.twap,
        ctx.accounts.user_position.periodic_drip_amount,
        ctx.accounts.vault_proto_config.token_a_drip_trigger_spread,
    );
    let withdrawable_amount_b_before_fees = ctx
        .accounts
        .user_position
        .get_withdrawable_amount_with_max(max_withdrawable_amount_b);

    // 2. Account for Withdrawal Spread on Token B
    let withdrawal_spread_amount_b = calculate_spread_amount(
        withdrawable_amount_b_before_fees,
        ctx.accounts.vault_proto_config.token_b_withdrawal_spread,
    );
    let withdrawable_amount_b = withdrawable_amount_b_before_fees
        .checked_sub(withdrawal_spread_amount_b)
        .unwrap();

    // 3. No point in completing IX if there's nothing happening
    if withdrawable_amount_b == 0 {
        return Err(ErrorCode::WithdrawableAmountIsZero.into());
    }

    // 4. Transfer tokens (these are lazily executed below)
    let transfer_b_to_user = TransferToken::new(
        &ctx.accounts.token_program,
        &ctx.accounts.vault_token_b_account,
        &ctx.accounts.user_token_b_account,
        withdrawable_amount_b,
    );

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

    // 5. Update the user's position state to reflect the newly withdrawn amount
    ctx.accounts
        .user_position
        .increase_withdrawn_amount(withdrawable_amount_b_before_fees);

    /* MANUAL CPI (INTERACTIONS) */

    // 6. Invoke the token transfer IX's
    transfer_b_to_user.execute(&ctx.accounts.vault)?;
    if let Some(transfer) = transfer_b_to_treasury {
        transfer.execute(&ctx.accounts.vault)?;
    }

    Ok(())
}
