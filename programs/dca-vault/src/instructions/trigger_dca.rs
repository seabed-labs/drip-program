use crate::state::{Vault, VaultProtoConfig, VaultPeriod};
use anchor_lang::{prelude::*, solana_program};
use anchor_spl::token::{Token, TokenAccount};
use spl_token_swap::state::SwapV1;
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

    // TODO: make sure this is derived using period ID = vault.last_dca_period + 1
    // to avoid duplicate DCAs
    pub current_vault_period_account: Account<'info, VaultPeriod>,
    pub last_vault_period_account: Account<'info, VaultPeriod>,

    // TODO: Thsi will likely be SwapV1, but requires Serialization/Deserialization to be
    // implemented
    pub swap_liquidity_pool: AccountInfo<'info>,

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

    let vault = &mut ctx.accounts.vault;
    let current_vault_period_account = &mut ctx.accounts.current_vault_period_account;
    let last_vault_period_account = &mut ctx.accounts.last_vault_period_account;

    let now = Clock::get().unwrap().unix_timestamp;

    if !dca_allowed(vault.dca_activation_timestamp, now, 
        ctx.accounts.vault_proto_config.granularity) {
            return Err(ErrorCode::DuplicateDCAError.into());
    }

    // TODO: Figure out how to "freeze" an exchange rate; so that this value is exactly
    // the same at the token swap execution
    let exchange_rate: u64 = get_exchange_rate();

    swap_tokens(
        vault.drip_amount,
        ctx.accounts.vault_token_a_account.key(),
        ctx.accounts.vault_token_b_account.key()
    );
    
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
fn dca_allowed(last_dca_activation_timetamp: i64, current_dca_trigger_time: i64, granularity: i64) -> bool {
    true
}

/*
Invokes CPI to SPL's swap IX / Serum's Dex
swap ix requires lot other authority accounts for verification; add them later
*/
fn swap_tokens(ctx: Context<TriggerDCA>) {
    solana_program::program::invoke(spl_token_swap::instruction::swap(
        &ctx.accounts.token_swap_program.key(),
        &ctx.accounts.token_program.key(),
        &ctx.accounts.swap_liquidity_pool.key(),
        &ctx.accounts.swap_authority.key(),
        user_transfer_authority_pubkey,
        source_pubkey,
        swap_source_pubkey,
        swap_destination_pubkey,
        destination_pubkey,
        pool_mint_pubkey,
        pool_fee_pubkey,
        host_fee_pubkey,
        instruction
    ));
}

fn get_exchange_rate() -> u64{
    return 1; // fake value for now
}