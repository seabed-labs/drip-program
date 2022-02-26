use anchor_lang::prelude::*;

pub mod instructions;
pub mod math;
pub mod state;

use instructions::*;

declare_id!("6rCWVjanBs1gx5jhpUAXoDqLwwURaNxKoGUxczjG6hFX");

#[program]
pub mod dca_vault {
    use super::*;

    pub fn init_vault_proto_config(
        ctx: Context<InitializeVaultProtoConfig>,
        granularity: i64,
    ) -> ProgramResult {
        instructions::init_vault_proto_config::handler(ctx, granularity)
    }

    pub fn init_vault(ctx: Context<InitializeVault>, bumps: InitializeVaultBumps) -> ProgramResult {
        instructions::init_vault::handler(ctx, bumps)
    }

    pub fn deposit(ctx: Context<Deposit>, params: DepositParams) -> ProgramResult {
        instructions::deposit::handler(ctx, params)
    }
}
