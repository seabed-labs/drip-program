use crate::state::{Vault, VaultProtoConfig, VaultPeriod};
use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount};

#[derive(Accounts)]
pub struct TriggerDCA<'info> {
    // TODO (capp) Add constraints for everything

    pub vault: Account<'info, Vault>,
    pub vault_proto_config: Account<'info, VaultProtoConfig>,

    // User that triggers the DCA
    pub dca_trigger_source: Signer<'info>,

    // Tokens will be swapped between these accounts
    vault_token_a_account: Account<'info, TokenAccount>,
    vault_token_b_account: Account<'info, TokenAccount>,

    // TODO: make sure this is derived using period ID = vault.last_dca_period + 1
    // to avoid duplicate DCAs
    current_vault_period_account: Account<'info, VaultPeriod>,
    last_vault_period_account: Account<'info, VaultPeriod>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<TriggerDCA>) -> ProgramResult {

    let vault = &mut ctx.accounts.vault;
    let current_vault_period_account = &mut ctx.accounts.current_vault_period_account;
    let last_vault_period_account = &mut ctx.accounts.last_vault_period_account;

    let now = Clock::get().unwrap().unix_timestamp;

    if dca_allowed(vault.dca_activation_timestamp, now, 
        ctx.accounts.vault_proto_config.granularity) {

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
    }

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
fn swap_tokens(swap_a_amount: u64, vault_token_a_account: Pubkey, vault_token_b_account: Pubkey) {

}

fn get_exchange_rate() -> u64{
    return 1; // fake value for now
}