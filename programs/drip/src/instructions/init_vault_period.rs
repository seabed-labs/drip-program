use crate::errors::ErrorCode;
use crate::state::{Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeVaultPeriodParams {
    period_id: u64,
}

#[derive(Accounts)]
#[instruction(params: InitializeVaultPeriodParams)]
pub struct InitializeVaultPeriod<'info> {
    #[account(
        init,
        space = VaultPeriod::ACCOUNT_SPACE,
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            params.period_id.to_string().as_bytes()
        ],
        bump,
        payer = creator,
        constraint = (params.period_id > vault.last_drip_period || (params.period_id == 0 && vault.last_drip_period == 0)) @ErrorCode::CannotInitializeVaultPeriodLessThanVaultCurrentPeriod
    )]
    vault_period: Account<'info, VaultPeriod>,

    #[account(
        seeds = [
            b"drip-v1".as_ref(),
            vault.token_a_mint.as_ref(),
            vault.token_b_mint.as_ref(),
            vault_proto_config.key().as_ref(),
        ],
        bump = vault.bump
    )]
    vault: Account<'info, Vault>,

    #[account(
        constraint = vault_proto_config.key() == vault.proto_config
    )]
    pub vault_proto_config: Account<'info, VaultProtoConfig>,

    // mut needed because we are initing accounts
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeVaultPeriod>,
    params: InitializeVaultPeriodParams,
) -> Result<()> {
    let vault_period = &mut ctx.accounts.vault_period;

    vault_period.init(
        ctx.accounts.vault.key(),
        params.period_id,
        ctx.bumps.get("vault_period"),
    )?;

    msg!("Initialized VaultPeriod");
    Ok(())
}
