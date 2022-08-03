use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::VaultProtoConfig;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitVaultProtoConfigParams {
    granularity: u64,
    // spread applied to each drip trigger in bips
    token_a_drip_trigger_spread: u16,
    // spread applied to each withdrawal in bips
    token_b_withdrawal_spread: u16,
    admin: Pubkey,
}

#[derive(Accounts)]
pub struct InitializeVaultProtoConfig<'info> {
    #[account(
        init,
        space = VaultProtoConfig::ACCOUNT_SPACE,
        payer = creator
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
    // TODO(Mocha): Flush this out
    if params.token_a_drip_trigger_spread >= 5000 || params.token_b_withdrawal_spread >= 5000 {
        return Err(ErrorCode::InvalidSpread.into());
    }
    /* STATE UPDATES (EFFECTS) */
    ctx.accounts.vault_proto_config.init(
        params.granularity,
        params.token_a_drip_trigger_spread,
        params.token_b_withdrawal_spread,
        params.admin,
    );
    Ok(())
}
