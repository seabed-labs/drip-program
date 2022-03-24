use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::{ByteSized, VaultProtoConfig};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitVaultProtoConfigParams {
    granularity: u64,
    // spread applied to each trigger DCA in bips
    trigger_dca_spread: u16,
    // spread applied to each withdrawal DCA in bips
    base_withdrawal_spread: u16,
}

#[derive(Accounts)]
pub struct InitializeVaultProtoConfig<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + VaultProtoConfig::byte_size()
    )]
    pub vault_proto_config: Account<'info, VaultProtoConfig>,

    // mut neeed because we are initing accounts
    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeVaultProtoConfig>,
    params: InitVaultProtoConfigParams,
) -> Result<()> {
    /* MANUAL CHECKS + COMPUTE (CHECKS) */
    if params.granularity == 0 {
        return Err(ErrorCode::InvalidGranularity.into());
    }
    if params.trigger_dca_spread > 10000 || params.base_withdrawal_spread > 10000 {
        return Err(ErrorCode::InvalidSpread.into());
    }
    /* STATE UPDATES (EFFECTS) */
    let vault_proto_config = &mut ctx.accounts.vault_proto_config;
    vault_proto_config.init(
        params.granularity,
        params.trigger_dca_spread,
        params.base_withdrawal_spread,
    );
    Ok(())
}
