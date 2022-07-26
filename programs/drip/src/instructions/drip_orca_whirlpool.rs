use crate::errors::ErrorCode;
use crate::state::{Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use spl_token::state::AccountState;
use std::str::FromStr;

#[derive(Clone)]
pub struct WhirlpoolProgram;

impl anchor_lang::Id for WhirlpoolProgram {
    fn id() -> Pubkey {
        Pubkey::from_str(&"whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc")
            .expect("Error creating hardocded pubkey")
    }
}

#[derive(Accounts)]
pub struct DripOrcaWhirlpool<'info> {
    // User that triggers the DCA
    pub drip_trigger_source: Signer<'info>,

    #[account(
        // mut needed
        mut,
        seeds = [
            b"drip-v1".as_ref(),
            vault.token_a_mint.as_ref(),
            vault.token_b_mint.as_ref(),
            vault.proto_config.as_ref()
        ],
        bump = vault.bump,
    )]
    pub vault: Box<Account<'info, Vault>>,

    #[account(
        constraint = vault_proto_config.granularity != 0,
        constraint = vault_proto_config.key() == vault.proto_config
    )]
    pub vault_proto_config: Box<Account<'info, VaultProtoConfig>>,

    #[account(
        seeds = [
            b"vault_period".as_ref(),
            last_vault_period.vault.as_ref(),
            last_vault_period.period_id.to_string().as_bytes().as_ref()
        ],
        bump = last_vault_period.bump,
        constraint = last_vault_period.period_id == vault.last_dca_period,
        constraint = last_vault_period.vault == vault.key()
    )]
    pub last_vault_period: Box<Account<'info, VaultPeriod>>,

    #[account(
        // mut needed because we are changing state
        mut,
        seeds = [
            b"vault_period".as_ref(),
            current_vault_period.vault.as_ref(),
            current_vault_period.period_id.to_string().as_bytes().as_ref()
        ],
        bump = current_vault_period.bump,
        constraint = current_vault_period.period_id == vault.last_dca_period.checked_add(1).unwrap(),
        constraint = current_vault_period.vault == vault.key()
    )]
    pub current_vault_period: Box<Account<'info, VaultPeriod>>,

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

    #[account(
        // mut needed because we are changing balance
        mut,
        associated_token::mint = token_a_mint,
        associated_token::authority = vault,
        constraint = vault_token_a_account.state == AccountState::Initialized,
        constraint = vault_token_a_account.amount >= vault.drip_amount
    )]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        associated_token::mint = token_b_mint,
        associated_token::authority = vault,
        constraint = vault_token_b_account.state == AccountState::Initialized
    )]
    pub vault_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = swap_token_a_account.mint == vault.token_a_mint @ErrorCode::InvalidMint,
        constraint = swap_token_a_account.owner == whirlpool.key(),
        constraint = swap_token_a_account.state == AccountState::Initialized,
    )]
    pub swap_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = swap_token_b_account.mint == vault.token_b_mint @ErrorCode::InvalidMint,
        constraint = swap_token_b_account.owner == whirlpool.key(),
        constraint = swap_token_b_account.state == AccountState::Initialized
    )]
    pub swap_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = drip_fee_token_a_account.mint == vault.token_a_mint @ErrorCode::InvalidMint,
        constraint = drip_fee_token_a_account.state == AccountState::Initialized
    )]
    pub drip_fee_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(address = Token::id())]
    pub token_program: Program<'info, Token>,

    #[account(address = anchor_spl::associated_token::ID)]
    pub associated_token_program: Program<'info, AssociatedToken>,

    pub whirlpool_program: Program<'info, WhirlpoolProgram>,

    #[account(address = System::id())]
    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,

    #[account(mut)]
    // TODO: Figure this out
    /// CHECK: Temporary
    pub whirlpool: UncheckedAccount<'info>,

    #[account(mut)]
    // TODO: Figure this out
    /// CHECK: Temporary
    pub tick_array_0: UncheckedAccount<'info>,

    #[account(mut)]
    // TODO: Figure this out
    /// CHECK: Temporary
    pub tick_array_1: UncheckedAccount<'info>,

    #[account(mut)]
    // TODO: Figure this out
    /// CHECK: Temporary
    pub tick_array_2: UncheckedAccount<'info>,

    #[account(seeds = [b"oracle", whirlpool.key().as_ref()], bump)]
    // TODO: Figure this out
    /// Oracle is currently unused and will be enabled on subsequent updates
    /// CHECK: Temporary
    pub oracle: UncheckedAccount<'info>,
}

pub fn handler(_ctx: Context<DripOrcaWhirlpool>) -> Result<()> {
    // TODO(matcha)
    Ok(())
}
