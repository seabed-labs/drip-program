use crate::actions::validate_oracle;
use crate::errors::DripError;
use crate::instruction_accounts::{
    SetVaultOracleConfigAccounts, SetVaultOracleConfigParams, UpdateOracleConfigAccounts,
    UpdateOracleConfigParams,
};
use crate::interactions::executor::CpiExecutor;
use crate::state::{
    Vault, VaultProtoConfig, MAX_SLIPPAGE_LOWER_LIMIT_EXCLUSIVE,
    MAX_SLIPPAGE_UPPER_LIMIT_EXCLUSIVE, VAULT_SWAP_WHITELIST_SIZE,
};
use crate::validate;
use crate::ProgramError::UninitializedAccount;
use crate::{
    instruction_accounts::{InitializeVaultAccounts, InitializeVaultParams},
    state::traits::{Executable, Validatable},
    UpdateVaultWhitelistedSwapsAccounts, UpdateVaultWhitelistedSwapsParams,
};
use anchor_lang::prelude::*;

use spl_token::state::AccountState;
use std::collections::BTreeMap;

pub enum Admin<'a, 'info> {
    InitVault {
        accounts: &'a mut InitializeVaultAccounts<'info>,
        params: InitializeVaultParams,
        bumps: BTreeMap<String, u8>,
    },
    SetVaultSwapWhitelist {
        accounts: &'a mut UpdateVaultWhitelistedSwapsAccounts<'info>,
        params: UpdateVaultWhitelistedSwapsParams,
    },
    SetVaultOracleConfig {
        accounts: &'a mut SetVaultOracleConfigAccounts<'info>,
        params: SetVaultOracleConfigParams,
    },

    UpdateOracleConfig {
        accounts: &'a mut UpdateOracleConfigAccounts<'info>,
        params: UpdateOracleConfigParams,
    },
}

impl<'a, 'info> Validatable for Admin<'a, 'info> {
    fn validate(&self) -> Result<()> {
        match self {
            Admin::InitVault {
                accounts, params, ..
            } => {
                validate_vault_admin(accounts.creator.key(), &accounts.vault_proto_config, None)?;

                validate!(
                    accounts.token_a_account.mint == accounts.token_a_mint.key(),
                    DripError::InvalidMint
                );

                validate!(
                    accounts.token_b_account.mint == accounts.token_b_mint.key(),
                    DripError::InvalidMint
                );

                validate!(
                    accounts.treasury_token_b_account.mint == accounts.token_b_mint.key(),
                    DripError::InvalidMint
                );

                validate!(
                    accounts.treasury_token_b_account.state == AccountState::Initialized,
                    UninitializedAccount
                );

                validate!(
                    params.whitelisted_swaps.len() <= VAULT_SWAP_WHITELIST_SIZE,
                    DripError::InvalidNumSwaps
                );

                validate!(
                    params.max_slippage_bps > MAX_SLIPPAGE_LOWER_LIMIT_EXCLUSIVE
                        && params.max_slippage_bps < MAX_SLIPPAGE_UPPER_LIMIT_EXCLUSIVE,
                    DripError::InvalidVaultMaxSlippage
                );
            }
            Admin::SetVaultSwapWhitelist {
                accounts, params, ..
            } => {
                validate_vault_admin(
                    accounts.admin.key(),
                    &accounts.vault_proto_config,
                    Some(&accounts.vault),
                )?;

                validate!(
                    params.whitelisted_swaps.len() <= VAULT_SWAP_WHITELIST_SIZE,
                    DripError::InvalidNumSwaps
                );
            }
            Admin::SetVaultOracleConfig { accounts, .. } => {
                validate_vault_admin(
                    accounts.admin.key(),
                    &accounts.vault_proto_config,
                    Some(&accounts.vault),
                )?;
            }
            Admin::UpdateOracleConfig {
                accounts, params, ..
            } => {
                validate!(
                    accounts.update_authority.key() == accounts.oracle_config.update_authority,
                    DripError::SignerIsNotAdmin
                );
                validate_oracle(
                    params.source,
                    &accounts.token_a_price.to_account_info(),
                    &accounts.token_b_price.to_account_info(),
                )?;
            }
        }

        Ok(())
    }
}

fn validate_vault_admin(
    admin: Pubkey,
    vault_proto_config: &Account<VaultProtoConfig>,
    vault: Option<&Account<Vault>>,
) -> Result<()> {
    validate!(
        admin == vault_proto_config.admin,
        DripError::SignerIsNotAdmin
    );
    if let Some(vault) = vault {
        validate!(
            vault_proto_config.key() == vault.proto_config,
            DripError::InvalidVaultProtoConfigReference
        );
    };
    Ok(())
}

impl<'a, 'info> Executable for Admin<'a, 'info> {
    fn execute(self, _cpi_executor: &mut impl CpiExecutor) -> Result<()> {
        match self {
            Admin::InitVault {
                accounts,
                params,
                bumps,
            } => {
                accounts.vault.init(
                    accounts.vault_proto_config.key(),
                    accounts.token_a_mint.key(),
                    accounts.token_b_mint.key(),
                    accounts.token_a_account.key(),
                    accounts.token_b_account.key(),
                    accounts.treasury_token_b_account.key(),
                    params.whitelisted_swaps,
                    params.max_slippage_bps,
                    accounts.vault_proto_config.granularity,
                    bumps.get("vault"),
                )?;
            }
            Admin::SetVaultSwapWhitelist { accounts, params } => {
                accounts
                    .vault
                    .set_whitelisted_swaps(params.whitelisted_swaps);
            }
            Admin::SetVaultOracleConfig { accounts, params } => {
                accounts.vault.set_oracle_config(params.oracle_config);
            }
            Admin::UpdateOracleConfig { accounts, params } => {
                accounts.oracle_config.init(
                    params.enabled,
                    params.source,
                    params.update_authority,
                    params.token_a_mint,
                    accounts.token_a_price.key(),
                    params.token_b_mint,
                    accounts.token_b_price.key(),
                );
            }
        }

        Ok(())
    }
}
