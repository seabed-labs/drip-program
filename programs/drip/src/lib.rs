use anchor_lang::prelude::*;
// use instructions::*;
use state::traits::*;
use instruction_accounts::*;
use processors::*;
pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod interactions;
pub mod macros;
pub mod math;
pub mod processors;
pub mod instruction_accounts;
pub mod state;

declare_id!("dripTrkvSyQKvkyWg7oi4jmeEGMA5scSYowHArJ9Vwk");

#[program]
pub mod drip {
    use super::*;
    // use crate::{update_vault_swap_whitelist::{
    //     UpdateVaultWhitelistedSwaps, UpdateVaultWhitelistedSwapsParams,
    // }, state::traits::IxProcessor};

    // pub fn init_vault_proto_config(
    //     ctx: Context<InitializeVaultProtoConfig>,
    //     params: InitVaultProtoConfigParams,
    // ) -> Result<()> {
    //     init_vault_proto_config::handler(ctx, params)
    // }

    // pub fn init_vault_period(
    //     ctx: Context<InitializeVaultPeriod>,
    //     params: InitializeVaultPeriodParams,
    // ) -> Result<()> {
    //     init_vault_period::handler(ctx, params)
    // }

    // pub fn deposit(ctx: Context<Deposit>, params: DepositParams) -> Result<()> {
    //     deposit::handler(ctx, params)
    // }

    // pub fn deposit_with_metadata(
    //     ctx: Context<DepositWithMetadata>,
    //     params: DepositParams,
    // ) -> Result<()> {
    //     deposit_with_metadata::handler(ctx, params)
    // }

    // pub fn withdraw_b(ctx: Context<WithdrawB>) -> Result<()> {
    //     withdraw_b::handler(ctx)
    // }

    // pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
    //     close_position::handler(ctx)
    // }

    // pub fn drip_spl_token_swap(ctx: Context<DripSPLTokenSwap>) -> Result<()> {
    //     drip_spl_token_swap::handler(ctx)
    // }

    // pub fn drip_orca_whirlpool(ctx: Context<DripOrcaWhirlpool>) -> Result<()> {
    //     drip_orca_whirlpool::handler(ctx)
    // }

    pub fn deposit(ctx: Context<DepositAccounts>, params: DepositParams) -> Result<()> {
        Deposit::WithoutMetadata { accounts: ctx.accounts, params }.execute()
    }

    pub fn deposit_with_metadata(ctx: Context<DepositWithMetadataAccounts>, params: DepositParams) -> Result<()> {
        Deposit::WithMetadata { accounts: ctx.accounts, params }.execute()
    }

    // Admin Ix's

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
