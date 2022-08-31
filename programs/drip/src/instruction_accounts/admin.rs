use crate::errors::ErrorCode;
use crate::state::{Vault, VaultProtoConfig};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateVaultWhitelistedSwapsParams {
    whitelisted_swaps: Vec<Pubkey>,
}

#[derive(Accounts)]
pub struct UpdateVaultWhitelistedSwapsAccounts<'info> {
    #[account(mut, address = vault_proto_config.admin @ ErrorCode::SignerIsNotAdmin)]
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
        constraint = vault_proto_config.key() == vault.proto_config @ ErrorCode::InvalidVaultProtoConfigReference
    )]
    pub vault_proto_config: Account<'info, VaultProtoConfig>,

    pub system_program: Program<'info, System>,
}
