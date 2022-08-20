use crate::errors::ErrorCode;
use crate::interactions::drip_utils::handle_drip;
use crate::state::{Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::Mint;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Clone)]
pub struct TokenSwap;

impl Id for TokenSwap {
    fn id() -> Pubkey {
        spl_token_swap::ID
    }
}

#[derive(Accounts)]
pub struct DripSPLTokenSwap<'info> {
    // User that triggers the Drip
    pub drip_trigger_source: Signer<'info>,

    #[account(
        // mut needed because we're changing state
        mut,
        seeds = [
            b"drip-v1".as_ref(),
            vault_token_a_account.mint.as_ref(),
            vault_token_b_account.mint.as_ref(),
            vault_proto_config.key().as_ref()
        ],
        bump = vault.bump,
    )]
    pub vault: Box<Account<'info, Vault>>,

    #[account(
        constraint = vault_proto_config.key() == vault.proto_config @ErrorCode::InvalidVaultProtoConfigReference
    )]
    pub vault_proto_config: Box<Account<'info, VaultProtoConfig>>,

    #[account(
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            last_vault_period.period_id.to_string().as_bytes()
        ],
        bump = last_vault_period.bump,
        constraint = last_vault_period.period_id == vault.last_drip_period @ErrorCode::InvalidVaultPeriod,
        constraint = last_vault_period.vault == vault.key() @ErrorCode::InvalidVaultPeriod
    )]
    pub last_vault_period: Box<Account<'info, VaultPeriod>>,

    #[account(
        // mut needed because we are changing state
        mut,
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            current_vault_period.period_id.to_string().as_bytes()
        ],
        bump = current_vault_period.bump,
        constraint = current_vault_period.period_id == vault.last_drip_period.checked_add(1).unwrap() @ErrorCode::InvalidVaultPeriod,
        constraint = current_vault_period.vault == vault.key() @ErrorCode::InvalidVaultPeriod
    )]
    pub current_vault_period: Box<Account<'info, VaultPeriod>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = vault_token_a_account.owner == vault.key(),
        constraint = vault_token_a_account.amount >= vault.drip_amount
    )]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = vault_token_b_account.mint == vault.token_b_mint.key() @ErrorCode::InvalidMint,
        constraint = vault_token_b_account.owner == vault.key(),
    )]
    pub vault_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = swap_token_a_account.owner == swap_authority.key()
    )]
    pub swap_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = swap_token_b_account.owner == swap_authority.key()
    )]
    pub swap_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = drip_fee_token_a_account.mint == vault.token_a_mint.key() @ErrorCode::InvalidMint,
    )]
    pub drip_fee_token_a_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,

    // SPL Token Swap Specific Accounts
    /// CHECK: Checked by token-swap program
    pub swap: UncheckedAccount<'info>,

    #[account(
        // mut needed for CPI
        mut,
        // TODO(mocha): spl token swap should check auth
        constraint = swap_token_mint.mint_authority.contains(&swap_authority.key()),
        constraint = swap_token_mint.is_initialized
    )]
    pub swap_token_mint: Box<Account<'info, Mint>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        // TODO(mocha): spl token swap should check this
        constraint = swap_fee_account.mint == swap_token_mint.key()
    )]
    pub swap_fee_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: Checked by token-swap program
    pub swap_authority: UncheckedAccount<'info>,

    pub token_swap_program: Program<'info, TokenSwap>,
}

pub fn handler(ctx: Context<DripSPLTokenSwap>) -> Result<()> {
    handle_drip(
        &mut ctx.accounts.vault,
        &ctx.accounts.vault_proto_config,
        &mut ctx.accounts.vault_token_a_account,
        &mut ctx.accounts.vault_token_b_account,
        &mut ctx.accounts.drip_fee_token_a_account,
        &ctx.accounts.last_vault_period,
        &mut ctx.accounts.current_vault_period,
        &mut ctx.accounts.swap_token_a_account,
        &mut ctx.accounts.swap_token_b_account,
        &ctx.accounts.token_program,
        Some((
            &ctx.accounts.swap,
            &ctx.accounts.swap_token_mint,
            &ctx.accounts.swap_fee_account,
            &ctx.accounts.swap_authority,
            &ctx.accounts.token_swap_program,
        )),
        None,
    )
}
