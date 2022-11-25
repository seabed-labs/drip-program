use crate::actions::validate_oracle;
use crate::errors::DripError;
use crate::instruction_accounts::{
    SetVaultOracleConfigAccounts, UpdateOracleConfigAccounts, UpdateOracleConfigParams,
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
    SetVaultFieldCommonAccounts, SetVaultWhitelistedSwapsParams,
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
        accounts: &'a mut SetVaultFieldCommonAccounts<'info>,
        params: SetVaultWhitelistedSwapsParams,
    },
    SetVaultOracleConfig {
        accounts: &'a mut SetVaultOracleConfigAccounts<'info>,
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
                validate!(
                    accounts.creator.key() == accounts.vault_proto_config.admin,
                    DripError::SignerIsNotAdmin
                );

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
                validate_signer_is_vault_admin(
                    &accounts.admin,
                    &accounts.vault_proto_config,
                    &accounts.vault,
                )?;

                validate!(
                    params.whitelisted_swaps.len() <= VAULT_SWAP_WHITELIST_SIZE,
                    DripError::InvalidNumSwaps
                );
            }
            Admin::SetVaultOracleConfig { accounts, .. } => {
                validate_signer_is_vault_admin(
                    &accounts.vault_update_common_accounts.admin,
                    &accounts.vault_update_common_accounts.vault_proto_config,
                    &accounts.vault_update_common_accounts.vault,
                )?;
            }
            Admin::UpdateOracleConfig {
                accounts, params, ..
            } => {
                validate!(
                    accounts.current_update_authority.key()
                        == accounts.oracle_config.update_authority,
                    DripError::SignerIsNotAdmin
                );
                validate_oracle(
                    params.source,
                    &accounts.new_token_a_price.to_account_info(),
                    &accounts.new_token_b_price.to_account_info(),
                )?;
            }
        }

        Ok(())
    }
}

// validates that the signer has the authority to update a vault
// - checks that the vault matches the proto config
// - checks that the proto config admin matches the signer
fn validate_signer_is_vault_admin(
    admin: &Signer,
    vault_proto_config: &Account<VaultProtoConfig>,
    vault: &Account<Vault>,
) -> Result<()> {
    validate!(
        admin.key() == vault_proto_config.admin,
        DripError::SignerIsNotAdmin
    );
    validate!(
        vault_proto_config.key() == vault.proto_config,
        DripError::InvalidVaultProtoConfigReference
    );
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
            Admin::SetVaultOracleConfig { accounts } => {
                accounts
                    .vault_update_common_accounts
                    .vault
                    .set_oracle_config(accounts.new_oracle_config.key());
            }
            Admin::UpdateOracleConfig { accounts, params } => {
                accounts.oracle_config.set(
                    params.enabled,
                    params.source,
                    params.new_update_authority,
                    accounts.new_token_a_mint.key(),
                    accounts.new_token_a_price.key(),
                    accounts.new_token_b_mint.key(),
                    accounts.new_token_b_price.key(),
                );
            }
        }

        Ok(())
    }
}
