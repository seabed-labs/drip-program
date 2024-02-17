use crate::errors::DripError;
use crate::instruction_accounts::{
    CloseVaultAccounts, CloseVaultPeriodAccounts, CloseVaultProtoConfigAccounts,
    InitializeVaultAccountsBumps, WithdrawAAccounts, WithdrawAccounts,
};
use crate::interactions::close_account::CloseAccount;
use crate::interactions::executor::CpiExecutor;
use crate::interactions::transfer_token::TransferToken;
use crate::state::{
    Vault, MAX_SLIPPAGE_LOWER_LIMIT_EXCLUSIVE, MAX_SLIPPAGE_UPPER_LIMIT_EXCLUSIVE,
    VAULT_SWAP_WHITELIST_SIZE,
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

pub enum Admin<'a, 'info> {
    InitVault {
        accounts: &'a mut InitializeVaultAccounts<'info>,
        params: InitializeVaultParams,
        bumps: InitializeVaultAccountsBumps,
    },
    SetVaultSwapWhitelist {
        accounts: &'a mut UpdateVaultWhitelistedSwapsAccounts<'info>,
        params: UpdateVaultWhitelistedSwapsParams,
    },
    WithdrawA {
        accounts: &'a mut WithdrawAAccounts<'info>,
    },
    Withdraw {
        accounts: &'a mut WithdrawAccounts<'info>,
    },
    CloseVaultPeriod {
        accounts: &'a mut CloseVaultPeriodAccounts<'info>,
    },
    CloseVault {
        accounts: &'a mut CloseVaultAccounts<'info>,
    },
    CloseVaultProtoConfig {
        accounts: &'a mut CloseVaultProtoConfigAccounts<'info>,
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
                validate!(
                    accounts.admin.key() == accounts.vault_proto_config.admin,
                    DripError::SignerIsNotAdmin
                );

                validate!(
                    accounts.vault_proto_config.key() == accounts.vault.proto_config,
                    DripError::InvalidVaultProtoConfigReference
                );

                validate!(
                    params.whitelisted_swaps.len() <= VAULT_SWAP_WHITELIST_SIZE,
                    DripError::InvalidNumSwaps
                );
            }
            Admin::WithdrawA { .. } => {
                return Err(DripError::WithdrawADeprecated.into());
            }
            Admin::Withdraw { accounts } => {
                validate!(
                    accounts.admin.key() == accounts.vault_proto_config.admin,
                    DripError::SignerIsNotAdmin
                );

                validate!(
                    accounts.vault_proto_config.key() == accounts.vault.proto_config,
                    DripError::InvalidVaultProtoConfigReference
                );
            }
            Admin::CloseVaultPeriod { accounts } => {
                validate!(
                    accounts.vault_proto_config.admin == accounts.common.admin.key(),
                    DripError::InvalidVaultProtoConfigReference
                );
                validate!(
                    accounts.vault_period.dar.eq(&0),
                    DripError::VaultPeriodDarNotEmpty
                );
                validate!(
                    accounts.vault_proto_config.key() == accounts.vault.proto_config.key(),
                    DripError::InvalidVaultReference
                );
                validate!(
                    accounts.vault.drip_amount.eq(&0),
                    DripError::VaultDripAmountNotZero
                );
            }
            Admin::CloseVault { accounts } => {
                validate!(
                    accounts.vault.proto_config.key() == accounts.vault_proto_config.key(),
                    DripError::InvalidVaultProtoConfigReference
                );
                validate!(
                    accounts.vault_proto_config.admin == accounts.common.admin.key(),
                    DripError::InvalidVaultProtoConfigReference
                );
                validate!(
                    accounts.vault.drip_amount.eq(&0),
                    DripError::VaultDripAmountNotZero
                );
            }
            Admin::CloseVaultProtoConfig { accounts } => {
                validate!(
                    accounts.vault_proto_config.admin == accounts.common.admin.key(),
                    DripError::InvalidVaultProtoConfigReference
                );
            }
        }

        Ok(())
    }
}

impl<'a, 'info> Executable for Admin<'a, 'info> {
    fn execute(self, cpi_executor: &mut impl CpiExecutor) -> Result<()> {
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
                    bumps.vault,
                );
            }
            Admin::SetVaultSwapWhitelist { accounts, params } => {
                accounts
                    .vault
                    .set_whitelisted_swaps(params.whitelisted_swaps);
            }
            Admin::Withdraw { accounts } => {
                let withdrawable_amount = accounts.vault_token_account.amount;

                let transfer_token_from_vault = TransferToken::new(
                    &accounts.token_program,
                    &accounts.vault_token_account,
                    &accounts.destination_token_account,
                    &accounts.vault.to_account_info(),
                    withdrawable_amount,
                );

                let signer: &Vault = &accounts.vault;
                cpi_executor.execute_all(vec![&Some(&transfer_token_from_vault)], signer)?;
            }
            Admin::CloseVaultPeriod { accounts } => {
                accounts
                    .vault_period
                    .close(accounts.common.sol_destination.to_account_info())?;
            }
            Admin::CloseVault { accounts } => {
                /* STATE UPDATES (EFFECTS) */
                let close_vault_token_a_account = CloseAccount::new(
                    &accounts.token_program,
                    &accounts.vault_token_a_account,
                    &accounts.common.sol_destination,
                    &accounts.vault.to_account_info(),
                );

                let close_vault_token_b_account = CloseAccount::new(
                    &accounts.token_program,
                    &accounts.vault_token_b_account,
                    &accounts.common.sol_destination,
                    &accounts.vault.to_account_info(),
                );

                // /* MANUAL CPI (INTERACTIONS) */
                let signer: &Vault = &accounts.vault;
                cpi_executor.execute_all(
                    vec![
                        &Some(&close_vault_token_a_account),
                        &Some(&close_vault_token_b_account),
                    ],
                    signer,
                )?;

                accounts
                    .vault
                    .close(accounts.common.sol_destination.to_account_info())?;
            }
            Admin::CloseVaultProtoConfig { accounts } => {
                accounts
                    .vault_proto_config
                    .close(accounts.common.sol_destination.to_account_info())?;
            }
            Admin::WithdrawA { .. } => {
                return Err(DripError::WithdrawADeprecated.into());
            }
        }

        Ok(())
    }
}
