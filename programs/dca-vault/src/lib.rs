use anchor_lang::prelude::*;

use instructions::*;

pub mod instructions;
pub mod macros;
pub mod math;
pub mod state;

declare_id!("6rCWVjanBs1gx5jhpUAXoDqLwwURaNxKoGUxczjG6hFX");

// TODO(matcha): Restrict to bare minimum mutable accounts

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

    pub fn withdraw_b(ctx: Context<WithdrawB>) -> Result<()> {
        instructions::withdraw_b::handler(ctx)
    }
}
