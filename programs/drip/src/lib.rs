use anchor_lang::prelude::*;
// use instructions::*;
use actions::*;
use instruction_accounts::*;
use state::traits::*;
pub mod actions;
pub mod constants;
pub mod errors;
pub mod events;
pub mod instruction_accounts;
pub mod instructions;
pub mod interactions;
pub mod macros;
pub mod math;
pub mod state;

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
        })
    }

    pub fn deposit(ctx: Context<DepositAccounts>, params: DepositParams) -> Result<()> {
        handle_action(Deposit::WithoutMetadata {
            accounts: ctx.accounts,
            params,
        })
    }

    pub fn deposit_with_metadata(
        ctx: Context<DepositWithMetadataAccounts>,
        params: DepositParams,
    ) -> Result<()> {
        handle_action(Deposit::WithMetadata {
            accounts: ctx.accounts,
            params,
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

    pub fn close_position(ctx: Context<ClosePositionAccounts>) -> Result<()> {
        handle_action(Withdraw::ClosePosition {
            accounts: ctx.accounts,
        })
    }

    pub fn withdraw_b(ctx: Context<WithdrawBAccounts>) -> Result<()> {
        handle_action(Withdraw::WithdrawB {
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
        })
    }

    pub fn update_vault_whitelisted_swaps(
        ctx: Context<UpdateVaultWhitelistedSwapsAccounts>,
        params: UpdateVaultWhitelistedSwapsParams,
    ) -> Result<()> {
        handle_action(Admin::UpdateVaultWhitelistedSwaps {
            accounts: ctx.accounts,
            params,
        })
    }

    // pub fn init_vault(ctx: Context<InitializeVault>, params: InitializeVaultParams) -> Result<()> {
    //     init_vault::handler(ctx, params)
    // }

    // pub fn update_vault_whitelisted_swaps(
    //     ctx: Context<UpdateVaultWhitelistedSwaps>,
    //     params: UpdateVaultWhitelistedSwapsParams,
    // ) -> Result<()> {
    //     update_vault_swap_whitelist::handler(ctx, params)
    // }
}

fn handle_action(action: impl Validatable + Executable) -> Result<()> {
    action.validate()?;
    action.execute()
}
