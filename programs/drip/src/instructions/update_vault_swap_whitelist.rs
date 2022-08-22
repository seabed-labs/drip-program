use crate::errors::ErrorCode;
use crate::state::{Vault, VaultProtoConfig};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateVaultWhitelistedSwapsParams {
    whitelisted_swaps: Vec<Pubkey>,
}

#[derive(Accounts)]
pub struct UpdateVaultWhitelistedSwaps<'info> {
    #[account(mut, address = vault_proto_config.admin @ErrorCode::SignerIsNotAdmin)]
    pub admin: Signer<'info>,

    #[account(
        // mut needed because we are changing state
        mut,
        seeds = [
            b"drip-v1".as_ref(),
            vault.token_a_mint.key().as_ref(),
            vault.token_b_mint.key().as_ref(),
            vault_proto_config.key().as_ref(),
        ],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        constraint = vault_proto_config.key() == vault.proto_config @ErrorCode::InvalidVaultProtoConfigReference
    )]
    pub vault_proto_config: Account<'info, VaultProtoConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<UpdateVaultWhitelistedSwaps>,
    params: UpdateVaultWhitelistedSwapsParams,
) -> Result<()> {
    /* MANUAL CHECKS + COMPUTE (CHECKS) */
    let should_limit_swaps = !params.whitelisted_swaps.is_empty();
    let mut whitelisted_swaps: [Pubkey; 5] = Default::default();
    for (i, s) in params.whitelisted_swaps.iter().enumerate() {
        whitelisted_swaps[i] = *s;
    }
    /* STATE UPDATES (EFFECTS) */
    ctx.accounts
        .vault
        .update_whitelisted_swaps(whitelisted_swaps, should_limit_swaps);
    Ok(())
}
