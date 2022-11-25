use actions::*;
use anchor_lang::prelude::*;
use instruction_accounts::*;
use interactions::executor::RealCpiExecutor;
use state::traits::*;
pub mod actions;
pub mod constants;
pub mod errors;
pub mod events;
pub mod instruction_accounts;
pub mod interactions;
pub mod macros;
pub mod math;
pub mod state;
#[cfg(test)]
pub mod test;

declare_id!("dripTrkvSyQKvkyWg7oi4jmeEGMA5scSYowHArJ9Vwk");

#[program]
pub mod drip {
    use super::*;

    pub fn init_vault_proto_config(
        ctx: Context<InitializeVaultProtoConfigAccounts>,
        params: InitializeVaultProtoConfigParams,
    ) -> Result<()> {
        handle_action(Init::VaultProtoConfig {
            accounts: ctx.accounts,
            params,
        })
    }

    pub fn init_vault_period(
        ctx: Context<InitializeVaultPeriodAccounts>,
        params: InitializeVaultPeriodParams,
    ) -> Result<()> {
        handle_action(Init::VaultPeriod {
            accounts: ctx.accounts,
            params,
            bumps: ctx.bumps,
        })
    }

    pub fn init_oracle_config(
        ctx: Context<InitializeOracleConfigAccounts>,
        params: InitializeOracleConfigParams,
    ) -> Result<()> {
        handle_action(Init::OracleConfig {
            accounts: ctx.accounts,
            params,
        })
    }

    pub fn deposit(ctx: Context<DepositAccounts>, params: DepositParams) -> Result<()> {
        handle_action(Deposit::WithoutMetadata {
            accounts: ctx.accounts,
            params,
            bumps: ctx.bumps,
        })
    }

    pub fn deposit_with_metadata(
        ctx: Context<DepositWithMetadataAccounts>,
        params: DepositParams,
    ) -> Result<()> {
        handle_action(Deposit::WithMetadata {
            accounts: ctx.accounts,
            params,
            bumps: ctx.bumps,
        })
    }

    pub fn drip_spl_token_swap(ctx: Context<DripSPLTokenSwapAccounts>) -> Result<()> {
        handle_action(Drip::SPLTokenSwap {
            accounts: ctx.accounts,
        })
    }

    pub fn drip_orca_whirlpool(ctx: Context<DripOrcaWhirlpoolAccounts>) -> Result<()> {
        handle_action(Drip::OrcaWhirlpool {
            accounts: ctx.accounts,
        })
    }

    pub fn withdraw_b(ctx: Context<WithdrawBAccounts>) -> Result<()> {
        handle_action(Withdraw::WithoutClosePosition {
            accounts: ctx.accounts,
        })
    }

    pub fn close_position(ctx: Context<ClosePositionAccounts>) -> Result<()> {
        handle_action(Withdraw::WithClosePosition {
            accounts: ctx.accounts,
        })
    }

    // Admin Ix's

    pub fn init_vault(
        ctx: Context<InitializeVaultAccounts>,
        params: InitializeVaultParams,
    ) -> Result<()> {
        handle_action(Admin::InitVault {
            accounts: ctx.accounts,
            params,
            bumps: ctx.bumps,
        })
    }

    pub fn update_oracle_config(
        ctx: Context<UpdateOracleConfigAccounts>,
        params: UpdateOracleConfigParams,
    ) -> Result<()> {
        handle_action(Admin::UpdateOracleConfig {
            accounts: ctx.accounts,
            params,
        })
    }

    pub fn set_vault_swap_whitelist(
        ctx: Context<SetVaultWhitelistedSwapsAccounts>,
        params: SetVaultWhitelistedSwapsParams,
    ) -> Result<()> {
        handle_action(Admin::SetVaultSwapWhitelist {
            accounts: ctx.accounts,
            params,
        })
    }

    pub fn set_vault_oracle_config(ctx: Context<SetVaultOracleConfigAccounts>) -> Result<()> {
        handle_action(Admin::SetVaultOracleConfig {
            accounts: ctx.accounts,
        })
    }
}

fn handle_action(action: impl Validatable + Executable) -> Result<()> {
    let mut cpi_executor = RealCpiExecutor;

    action.validate()?;
    action.execute(&mut cpi_executor)
}
