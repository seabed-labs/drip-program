use crate::state::{OracleConfig, Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::prelude::*;

use anchor_spl::token::{Mint, Token, TokenAccount};
use whirlpool::state::Whirlpool;

#[derive(Clone)]
pub struct TokenSwap;

impl Id for TokenSwap {
    fn id() -> Pubkey {
        spl_token_swap::ID
    }
}

#[derive(Clone)]
pub struct WhirlpoolProgram;

impl Id for WhirlpoolProgram {
    fn id() -> Pubkey {
        whirlpool::ID
    }
}

#[derive(Accounts)]
pub struct DripCommonAccounts<'info> {
    // User that triggers the Drip
    pub drip_trigger_source: Signer<'info>,

    // mut reason: changing state
    #[account(mut)]
    pub vault: Box<Account<'info, Vault>>,

    pub vault_proto_config: Box<Account<'info, VaultProtoConfig>>,

    pub last_vault_period: Box<Account<'info, VaultPeriod>>,

    // mut reason: changing state
    #[account(mut)]
    pub current_vault_period: Box<Account<'info, VaultPeriod>>,

    // mut reason: changing balance
    #[account(mut)]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    // mut reason: changing balance
    #[account(mut)]
    pub vault_token_b_account: Box<Account<'info, TokenAccount>>,

    // mut reason: changing balance
    #[account(mut)]
    pub swap_token_a_account: Box<Account<'info, TokenAccount>>,

    // mut reason: changing balance
    #[account(mut)]
    pub swap_token_b_account: Box<Account<'info, TokenAccount>>,

    // mut reason: changing balance
    #[account(mut)]
    pub drip_fee_token_a_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DripOracleAccounts<'info> {
    pub oracle_config: Box<Account<'info, OracleConfig>>,
    /// CHECK: Need to manually decode and parse in ix
    pub token_a_price: UncheckedAccount<'info>,
    /// CHECK: Need to manually decode and parse in ix
    pub token_b_price: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct DripSPLTokenSwapAccounts<'info> {
    pub common: DripCommonAccounts<'info>,

    /// CHECK: Checked by token-swap program
    pub swap: UncheckedAccount<'info>,

    // mut reason: CPI
    #[account(mut)]
    pub swap_token_mint: Box<Account<'info, Mint>>,

    // mut reason: changing balance
    #[account(mut)]
    pub swap_fee_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: Checked by token-swap program
    pub swap_authority: UncheckedAccount<'info>,

    pub token_swap_program: Program<'info, TokenSwap>,
}

#[derive(Accounts)]
pub struct DripOrcaWhirlpoolAccounts<'info> {
    pub common: DripCommonAccounts<'info>,

    // mut reason: CPI
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

#[derive(Accounts)]
pub struct DripV2OrcaWhirlpoolAccounts<'info> {
    pub common: DripCommonAccounts<'info>,

    pub oracle_common: DripOracleAccounts<'info>,

    // mut reason: CPI
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
