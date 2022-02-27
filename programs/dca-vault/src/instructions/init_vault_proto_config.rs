use anchor_lang::prelude::*;

use crate::common::ErrorCode;
use crate::state::{ByteSized, VaultProtoConfig};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitVaultProtoConfigParams {
    granularity: u64,
}

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

pub fn handler(
    ctx: Context<InitializeVaultProtoConfig>,
    params: InitVaultProtoConfigParams,
) -> Result<()> {
    let vault_proto_config = &mut ctx.accounts.vault_proto_config;
    if params.granularity <= 0 {
        return Err(ErrorCode::InvalidGranularity.into());
    }
    vault_proto_config.granularity = params.granularity;
    Ok(())
}
