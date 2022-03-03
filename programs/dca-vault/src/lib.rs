use anchor_lang::prelude::*;

use instructions::*;

pub mod instructions;
pub mod math;
pub mod state;

declare_id!("6rCWVjanBs1gx5jhpUAXoDqLwwURaNxKoGUxczjG6hFX");

#[program]
pub mod dca_vault {
    use super::*;

    pub fn init_vault_proto_config(
        ctx: Context<InitializeVaultProtoConfig>,
        params: InitVaultProtoConfigParams,
    ) -> Result<()> {
        instructions::init_vault_proto_config::handler(ctx, params)
    }

    pub fn init_vault(ctx: Context<InitializeVault>) -> Result<()> {
        instructions::init_vault::handler(ctx)
    }

    pub fn init_vault_period(
        ctx: Context<InitializeVaultPeriod>,
        params: InitializeVaultPeriodParams,
    ) -> Result<()> {
        instructions::init_vault_period::handler(ctx, params)
    }

    pub fn deposit(ctx: Context<Deposit>, params: DepositParams) -> Result<()> {
        instructions::deposit::handler(ctx, params)
    }

    pub fn trigger_dca(ctx: Context<TriggerDCA>) -> Result<()> {
        instructions::trigger_dca::handler(ctx)
    }
}
