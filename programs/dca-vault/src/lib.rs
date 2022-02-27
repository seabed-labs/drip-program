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
    ) -> Result<()> {
        instructions::init_vault_proto_config::handler(ctx, granularity)
    }

    pub fn init_vault(ctx: Context<InitializeVault>) -> Result<()> {
        instructions::init_vault::handler(ctx)
    }

    pub fn init_vault_period(ctx: Context<InitializeVaultPeriod>) -> Result<()> {
        instructions::init_vault_period::handler(ctx)
    }

    pub fn deposit(ctx: Context<Deposit>, params: DepositParams) -> Result<()> {
        instructions::deposit::handler(ctx, params)
    }
}
