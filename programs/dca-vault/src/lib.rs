use anchor_lang::prelude::*;
use instructions::*;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod interactions;
pub mod macros;
pub mod math;
pub mod state;

declare_id!("AahZjZGD5Lv9HGPYUXZRS5GpeFFF13Wvx1fAFgwUxxDR");

#[program]
pub mod dca_vault {
    use super::*;

    pub fn init_vault_proto_config(
        ctx: Context<InitializeVaultProtoConfig>,
        params: InitVaultProtoConfigParams,
    ) -> Result<()> {
        instructions::init_vault_proto_config::handler(ctx, params)
    }

    pub fn init_vault(ctx: Context<InitializeVault>, params: InitializeVaultParams) -> Result<()> {
        init_vault::handler(ctx, params)
    }

    pub fn init_vault_period(
        ctx: Context<InitializeVaultPeriod>,
        params: InitializeVaultPeriodParams,
    ) -> Result<()> {
        init_vault_period::handler(ctx, params)
    }

    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        close_position::handler(ctx)
    }

    pub fn deposit(ctx: Context<Deposit>, params: DepositParams) -> Result<()> {
        deposit::handler(ctx, params)
    }

    pub fn withdraw_b(ctx: Context<WithdrawB>) -> Result<()> {
        withdraw_b::handler(ctx)
    }

    pub fn trigger_dca(ctx: Context<TriggerDCA>) -> Result<()> {
        trigger_dca::handler(ctx)
    }
}
