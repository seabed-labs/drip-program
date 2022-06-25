use crate::events::Log;
use crate::state::{Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeVaultPeriodParams {
    period_id: u64,
}

#[derive(Accounts)]
#[instruction(params: InitializeVaultPeriodParams)]
pub struct InitializeVaultPeriod<'info> {
    #[account(
        init,
        space = 80,
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            params.period_id.to_string().as_bytes().as_ref()
        ],
        bump,
        payer = creator
    )]
    vault_period: Account<'info, VaultPeriod>,

    #[account(
        seeds = [
            b"drip-v1".as_ref(),
            token_a_mint.key().as_ref(),
            token_b_mint.key().as_ref(),
            vault_proto_config.key().as_ref(),
        ],
        bump = vault.bump
    )]
    vault: Account<'info, Vault>,

    #[account(
        constraint = {
            token_a_mint.key() == vault.token_a_mint
        },
    )]
    pub token_a_mint: Account<'info, Mint>,

    #[account(
        constraint = {
            token_b_mint.key() == vault.token_b_mint
        },
    )]
    pub token_b_mint: Account<'info, Mint>,

    #[account(
        constraint = vault_proto_config.granularity != 0
    )]
    pub vault_proto_config: Account<'info, VaultProtoConfig>,

    // mut neeed because we are initing accounts
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

    emit!(Log {
        data: None,
        message: "initialized VaultPeriod".to_string(),
    });
    Ok(())
}
