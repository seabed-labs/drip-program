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

    pub fn deposit_a(ctx: Context<DepositA>, amount: u64, total_duration_millis: u64) -> ProgramResult {
        instructions::deposit_a::handler(ctx, amount, total_duration_millis)
    }

    pub fn withdraw_a(ctx: Context<WithdrawA>, position_id: u8, amount: u64) -> ProgramResult {
        instructions::withdraw_a::handler(ctx, position_id, amount)
    }

    pub fn withdraw_b(ctx: Context<WithdrawB>, position_id: u8, amount: u64) -> ProgramResult {
        instructions::withdraw_b::handler(ctx, position_id, amount)
    }

    pub fn check_vault_balance_a(ctx: Context<CheckVaultBalanceA>) -> ProgramResult {
        instructions::check_vault_balance_a::handler(ctx)
    }

    pub fn check_vault_balance_b(ctx: Context<CheckVaultBalanceB>) -> ProgramResult {
        instructions::check_vault_balance_b::handler(ctx)
    }

    pub fn trigger_dca(ctx: Context<TriggerDCA>) -> ProgramResult {
        instructions::trigger_dca::handler(ctx)
    }
}
