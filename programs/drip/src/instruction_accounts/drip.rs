use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use whirlpool::state::Whirlpool;

use crate::errors::DripError;
use crate::state::{Vault, VaultPeriod, VaultProtoConfig};

#[derive(Clone)]
pub struct TokenSwap;

impl Id for TokenSwap {
    fn id() -> Pubkey {
        spl_token_swap::ID
    }
}

#[derive(Accounts)]
pub struct DripSPLTokenSwapAccounts<'info> {
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
        constraint = vault_proto_config.key() == vault.proto_config @DripError::InvalidVaultProtoConfigReference
    )]
    pub vault_proto_config: Box<Account<'info, VaultProtoConfig>>,

    #[account(
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            last_vault_period.period_id.to_string().as_bytes()
        ],
        bump = last_vault_period.bump,
        constraint = last_vault_period.period_id == vault.last_drip_period @DripError::InvalidVaultPeriod,
        constraint = last_vault_period.vault == vault.key() @DripError::InvalidVaultPeriod
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
        constraint = current_vault_period.period_id == vault.last_drip_period.checked_add(1).unwrap() @DripError::InvalidVaultPeriod,
        constraint = current_vault_period.vault == vault.key() @DripError::InvalidVaultPeriod
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
        constraint = vault_token_b_account.mint == vault.token_b_mint.key() @DripError::InvalidMint,
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
        constraint = drip_fee_token_a_account.mint == vault.token_a_mint.key() @DripError::InvalidMint,
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
    )]
    pub swap_token_mint: Box<Account<'info, Mint>>,

    #[account(
        // mut needed because we are changing balance
        mut,
    )]
    pub swap_fee_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: Checked by token-swap program
    pub swap_authority: UncheckedAccount<'info>,

    pub token_swap_program: Program<'info, TokenSwap>,
}

#[derive(Clone)]
pub struct WhirlpoolProgram;

impl Id for WhirlpoolProgram {
    fn id() -> Pubkey {
        whirlpool::ID
    }
}

#[derive(Accounts)]
pub struct DripOrcaWhirlpoolAccounts<'info> {
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
        constraint = vault_proto_config.key() == vault.proto_config @DripError::InvalidVaultProtoConfigReference
    )]
    pub vault_proto_config: Box<Account<'info, VaultProtoConfig>>,

    #[account(
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            last_vault_period.period_id.to_string().as_bytes()
        ],
        bump = last_vault_period.bump,
        constraint = last_vault_period.period_id == vault.last_drip_period,
        constraint = last_vault_period.vault == vault.key()
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
        constraint = current_vault_period.period_id == vault.last_drip_period.checked_add(1).unwrap(),
        constraint = current_vault_period.vault == vault.key()
    )]
    pub current_vault_period: Box<Account<'info, VaultPeriod>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = vault_token_a_account.mint == vault.token_a_mint @DripError::InvalidMint,
        constraint = vault_token_a_account.owner == vault.key(),
        constraint = vault_token_a_account.amount >= vault.drip_amount
    )]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = vault_token_b_account.mint == vault.token_b_mint @DripError::InvalidMint,
        constraint = vault_token_b_account.owner == vault.key(),
    )]
    pub vault_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = swap_token_a_account.owner == whirlpool.key(),
    )]
    pub swap_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = swap_token_b_account.owner == whirlpool.key(),
    )]
    pub swap_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = drip_fee_token_a_account.mint == vault.token_a_mint @DripError::InvalidMint
    )]
    pub drip_fee_token_a_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,

    // Orca Whirlpool Specific Accounts
    #[account(mut)]
    pub whirlpool: Box<Account<'info, Whirlpool>>,

    #[account(mut)]
    /// CHECK: Checked by Whirlpool
    pub tick_array_0: UncheckedAccount<'info>,

    #[account(mut)]
    /// CHECK: Checked by Whirlpool
    pub tick_array_1: UncheckedAccount<'info>,

    #[account(mut)]
    /// CHECK: Checked by Whirlpool
    pub tick_array_2: UncheckedAccount<'info>,

    /// CHECK: Checked by Whirlpool
    pub oracle: UncheckedAccount<'info>,

    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
}
