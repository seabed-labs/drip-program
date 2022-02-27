use crate::state::{Vault, VaultPeriod};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeVaultPeriodParams {
    period_id: u64,
}

#[derive(Accounts)]
#[instruction(params: InitializeVaultPeriodParams)]
pub struct InitializeVaultPeriod<'info> {
    vault: Account<'info, Vault>,

    #[account(
        init,
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            params.period_id.to_string().as_bytes().as_ref()
        ],
        bump,
        payer = creator
    )]
    vault_period: Account<'info, VaultPeriod>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeVaultPeriod>,
    params: InitializeVaultPeriodParams,
) -> Result<()> {
    let vault_period = &mut ctx.accounts.vault_period;

    vault_period.init(ctx.accounts.vault.key(), params.period_id);

    msg!("Initialized VaultPeriod");
    Ok(())
}
