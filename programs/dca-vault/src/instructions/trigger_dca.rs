use crate::state::{Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::{prelude::*, solana_program};
use anchor_spl::token::{Token, TokenAccount};
use spl_token_swap::state::{SwapState};
use std::str::FromStr;

use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct TriggerDCA<'info> {
    // TODO (capp) Add constraints for everything
    pub vault: Account<'info, Vault>,
    pub vault_proto_config: Account<'info, VaultProtoConfig>,

    // User that triggers the DCA
    pub dca_trigger_source: Signer<'info>,

    // Tokens will be swapped between these accounts
    pub vault_token_a_account: Account<'info, TokenAccount>,
    pub vault_token_b_account: Account<'info, TokenAccount>,

    pub swap_token_a_account: Account<'info, TokenAccount>,
    pub swap_token_b_account: Account<'info, TokenAccount>,

    // TODO: make sure this is derived using period ID = vault.last_dca_period + 1
    // to avoid duplicate DCAs
    pub current_vault_period_account: Account<'info, VaultPeriod>,
    pub last_vault_period_account: Account<'info, VaultPeriod>,

    // TODO: Thsi will likely be SwapV1, but requires Serialization/Deserialization to be
    // implemented
    pub swap_liquidity_pool: AccountInfo<'info>,

    // TODO: These are temp, should be able to use it 
    // via swap_liquidity_pool.pool_mint / swap_liquidity_pool.pool_fee
    pub swap_liquidity_pool_mint: AccountInfo<'info>,
    pub swap_liquidity_pool_fee: AccountInfo<'info>,

    // TODO: Generate Authority ID defined in processor.rs. / authority_id
    pub swap_authority: AccountInfo<'info>,

    #[account(address = anchor_spl::token::ID)]
    pub token_program: Program<'info, Token>,

    // TODO: Test this is actually the Token swap program; clean this
    #[account(address = Pubkey::from_str("SwaPpA9LAaLfeLi3a68M4DjnLqgtticKg6CnyNwgAC8").unwrap())]
    pub token_swap_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<TriggerDCA>) -> ProgramResult {
    let now = Clock::get().unwrap().unix_timestamp;

    if !dca_allowed(
        ctx.accounts.vault.dca_activation_timestamp,
        now,
        ctx.accounts.vault_proto_config.granularity,
    ) {
        return Err(ErrorCode::DuplicateDCAError.into());
    }

    // TODO: Figure out how to "freeze" an exchange rate; so that this value is exactly
    // the same at the token swap execution
    let exchange_rate: u64 = get_exchange_rate();

    swap_tokens(
        &ctx,
        ctx.accounts.vault.drip_amount,
    );

    let vault = &mut ctx.accounts.vault;
    let current_vault_period_account = &mut ctx.accounts.current_vault_period_account;
    let last_vault_period_account = &mut ctx.accounts.last_vault_period_account;

    let prev_twap = last_vault_period_account.twap;
    let current_period_id = current_vault_period_account.period_id;

    let new_twap = (prev_twap * (current_period_id - 1) + exchange_rate) / current_period_id;
    current_vault_period_account.twap = new_twap;

    vault.last_dca_period = current_period_id; // same as += 1

    // If any position(s) are closing at this period, the drip amount needs to be reduced
    vault.drip_amount -= current_vault_period_account.dar;

    Ok(())
}

/*
Checks if a DCA has already been trigerred within that granularity
by comapring the current time and last_dca_activation_timetamp
*/
fn dca_allowed(
    last_dca_activation_timetamp: i64,
    current_dca_trigger_time: i64,
    granularity: i64,
) -> bool {
    true
}

/*
Invokes CPI to SPL's swap IX / Serum's Dex
swap ix requires lot other authority accounts for verification; add them later
*/
fn swap_tokens(ctx: &Context<TriggerDCA>, swap_amount: u64) -> ProgramResult {
    // TODO(capp): Call approve here

    let min_slippage_amt = get_minimum_slippage_amount();

    let ix = spl_token_swap::instruction::swap(
        ctx.accounts.token_swap_program.key,
        ctx.accounts.token_program.key,
        ctx.accounts.swap_liquidity_pool.key,
        ctx.accounts.swap_authority.key,
        ctx.accounts.swap_liquidity_pool.key, // TODO(capp): Invoke token.approve with this account as the delegate first (delegated_amount should be drip_amount)
        &ctx.accounts.vault_token_a_account.key(),
        &ctx.accounts.swap_token_a_account.key(),
        &ctx.accounts.swap_token_b_account.key(),
        &ctx.accounts.vault_token_b_account.key(),
        ctx.accounts.swap_liquidity_pool_fee.key, // swap.pool_mint (might need to pass in pool mint as well IFF we need to send the pool mint account to swap)
        ctx.accounts.swap_liquidity_pool_fee.key,
        None,
        spl_token_swap::instruction::Swap { amount_in: swap_amount, minimum_amount_out: min_slippage_amt },
    )?;

    // TODO (capp): Likely need to call invoke signed, figure out the seeds for it
    solana_program::program::invoke(&ix,
    &[
        ctx.accounts.token_swap_program.clone(),
        ctx.accounts.token_program.to_account_info().clone(),
        ctx.accounts.swap_liquidity_pool.clone(),
        ctx.accounts.swap_authority.clone(),
        ctx.accounts.vault_token_a_account.to_account_info().clone(),
        ctx.accounts.vault_token_b_account.to_account_info().clone(),
        ctx.accounts.swap_token_a_account.to_account_info().clone(),
        ctx.accounts.swap_token_b_account.to_account_info().clone(),
    ])
}

// TODO: Check the account balance difference of vault token b account before and after
fn get_exchange_rate() -> u64 {
    return 1; // fake value for now
}

// TODO (matcha) Do the math
fn get_minimum_slippage_amount() -> u64 {
    return 1; // fake value for now
}
