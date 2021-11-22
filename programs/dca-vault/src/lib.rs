use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("6rCWVjanBs1gx5jhpUAXoDqLwwURaNxKoGUxczjG6hFX");

#[program]
pub mod dca_vault {
    use super::*;

    pub fn init_vault_proto_config(ctx: Context<InitializeVaultProtoConfig>, granularity: u64) -> ProgramResult {
        instructions::init_vault_proto_config::handler(ctx, granularity)
    }

    pub fn init_vault(ctx: Context<InitializeVault>, bump: InitializeVaultBumps) -> ProgramResult {
        instructions::init_vault::handler(ctx, bump)
    }

    pub fn deposit(ctx: Context<DepositA>, amount: u64, total_duration_millis: u8) -> ProgramResult {
        instructions::deposit::handler(ctx, amount, total_duration_millis)
    }
}
