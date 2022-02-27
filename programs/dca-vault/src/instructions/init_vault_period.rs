use crate::state::{Vault, VaultPeriod};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeVaultPeriod<'info> {
    vault: Account<'info, Vault>,
    vault_period: Account<'info, VaultPeriod>,
}

pub fn handler(_ctx: Context<InitializeVaultPeriod>) -> Result<()> {
    Ok(())
}
