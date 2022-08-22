use crate::errors::ErrorCode;
use crate::interactions::deposit_utils::{handle_deposit, MetaplexTokenMetadata};
use crate::state::{Position, Vault, VaultPeriod};
use crate::DepositParams;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
#[instruction(params: DepositParams)]
pub struct DepositWithMetadata<'info> {
    #[account(
        // mut needed
        mut,
        seeds = [
            b"drip-v1".as_ref(),
            vault.token_a_mint.key().as_ref(),
            vault.token_b_mint.key().as_ref(),
            vault.proto_config.as_ref()
        ],
        bump = vault.bump
    )]
    pub vault: Box<Account<'info, Vault>>,

    #[account(
        // mut needed because we are changing state
        mut,
        has_one = vault,
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            vault_period_end.period_id.to_string().as_bytes()
        ],
        bump = vault_period_end.bump,
        constraint = params.number_of_swaps > 0 @ErrorCode::NumSwapsIsZero,
        constraint = vault_period_end.period_id > 0 @ErrorCode::InvalidVaultPeriod,
        constraint = vault_period_end.period_id == vault.last_drip_period.checked_add(params.number_of_swaps).unwrap() @ErrorCode::InvalidVaultPeriod
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
        init,
        mint::authority = vault,
        mint::decimals = 0,
        payer = depositor
    )]
    pub user_position_nft_mint: Box<Account<'info, Mint>>,

    // Token accounts
    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = {
            vault_token_a_account.mint == vault.token_a_mint &&
            vault_token_a_account.owner == vault.key()
        },
    )]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = {
            user_token_a_account.mint == vault.token_a_mint &&
            user_token_a_account.owner == depositor.key() &&
            user_token_a_account.delegate.contains(&vault.key()) &&
            params.token_a_deposit_amount > 0 &&
            user_token_a_account.delegated_amount >= params.token_a_deposit_amount
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

    // Other
    // mut needed because we are initing accounts
    #[account(mut)]
    pub depositor: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,

    /// CHECK: Checked by metaplex's program
    #[account(mut)]
    pub position_metadata_account: UncheckedAccount<'info>,
    pub metadata_program: Program<'info, MetaplexTokenMetadata>,
}

pub fn handler(ctx: Context<DepositWithMetadata>, params: DepositParams) -> Result<()> {
    handle_deposit(
        &ctx.accounts.depositor,
        &ctx.accounts.rent,
        &ctx.accounts.token_program,
        &ctx.accounts.system_program,
        &ctx.accounts.vault_token_a_account,
        &ctx.accounts.user_token_a_account,
        &ctx.accounts.user_position_nft_mint,
        &ctx.accounts.user_position_nft_account,
        &mut ctx.accounts.vault,
        &mut ctx.accounts.vault_period_end,
        &mut ctx.accounts.user_position,
        ctx.bumps.get("user_position"),
        params,
        Some((
            &ctx.accounts.metadata_program,
            &ctx.accounts.position_metadata_account,
        )),
    )
}
