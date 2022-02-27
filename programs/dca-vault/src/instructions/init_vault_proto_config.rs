use crate::common::ErrorCode;
use crate::state::{ByteSized, VaultProtoConfig};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeVaultProtoConfig<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + VaultProtoConfig::byte_size()
    )]
    pub vault_proto_config: Account<'info, VaultProtoConfig>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeVaultProtoConfig>, granularity: i64) -> Result<()> {
    let config = &mut ctx.accounts.vault_proto_config;
    config.granularity = granularity;
    if granularity <= 0 {
        return Err(ErrorCode::InvalidGranularity.into());
    }
    msg!("Initialized Vault Proto Config");
    Ok(())
}
