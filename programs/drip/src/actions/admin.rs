use crate::errors::DripError;
use crate::instruction_accounts::{
    AdminWithdrawAccounts, ClosePositionAccountAccounts, InitializeVaultAccountsBumps,
    WithdrawAAccounts,
};
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
    AdminWithdraw {
        accounts: &'a mut AdminWithdrawAccounts<'info>,
    },
    ClosePositionAccount {
        accounts: &'a mut ClosePositionAccountAccounts<'info>,
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
            Admin::WithdrawA { accounts } => {
                validate!(
                    accounts.admin.key() == accounts.vault_proto_config.admin,
                    DripError::SignerIsNotAdmin
                );

                validate!(
                    accounts.vault_proto_config.key() == accounts.vault.proto_config,
                    DripError::InvalidVaultProtoConfigReference
                );

                validate!(
                    accounts.vault_token_a_account.key() == accounts.vault.token_a_account,
                    DripError::IncorrectVaultTokenAccount
                );

                validate!(
                    accounts.admin_token_a_account.owner == accounts.admin.key(),
                    DripError::InvalidOwner
                );

                validate!(
                    accounts.vault.drip_amount == 0,
                    DripError::CannotWithdrawAWithNonZeroDripAmount
                );

                validate!(
                    accounts.vault_token_a_account.amount > 0,
                    DripError::VaultTokenAAccountIsEmpty
                );
            }
            Admin::AdminWithdraw { accounts } => {
                validate!(
                    accounts.admin.key() == accounts.vault_proto_config.admin,
                    DripError::SignerIsNotAdmin
                );

                validate!(
                    accounts.vault_proto_config.key() == accounts.vault.proto_config,
                    DripError::InvalidVaultProtoConfigReference
                );

                validate!(
                    accounts.vault_token_account.owner.key() == accounts.vault.key(),
                    DripError::IncorrectVaultTokenAccount
                );

                validate!(
                    accounts.vault.drip_amount == 0,
                    DripError::CannotWithdrawAWithNonZeroDripAmount
                );

                validate!(
                    accounts.vault_token_account.amount > 0,
                    DripError::VaultTokenAAccountIsEmpty
                );
            }
            Admin::ClosePositionAccount { accounts } => {
                validate!(
                    accounts.admin.key() == accounts.vault_proto_config.admin,
                    DripError::SignerIsNotAdmin
                );

                validate!(
                    accounts.vault_proto_config.key() == accounts.vault.proto_config,
                    DripError::InvalidVaultProtoConfigReference
                );

                validate!(
                    accounts.vault.key() == accounts.position.vault.key(),
                    DripError::InvalidVaultReference
                );

                validate!(accounts.position.is_closed, DripError::PositionIsNotClosed);
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
            Admin::WithdrawA { accounts } => {
                let withdrawable_amount_a = accounts.vault_token_a_account.amount;

                let transfer_a_to_admin = TransferToken::new(
                    &accounts.token_program,
                    &accounts.vault_token_a_account,
                    &accounts.admin_token_a_account,
                    &accounts.vault.to_account_info(),
                    withdrawable_amount_a,
                );

                let signer: &Vault = &accounts.vault;
                cpi_executor.execute_all(vec![&Some(&transfer_a_to_admin)], signer)?;
            }
            Admin::AdminWithdraw { accounts } => {
                let withdrawal_amount = accounts.vault_token_account.amount;
                let transfer = TransferToken::new(
                    &accounts.token_program,
                    &accounts.vault_token_account,
                    &accounts.destination_token_account,
                    &accounts.vault.to_account_info(),
                    withdrawal_amount,
                );
                let signer: &Vault = &accounts.vault;
                cpi_executor.execute_all(vec![&Some(&transfer)], signer)?;
            }
            Admin::ClosePositionAccount { accounts } => {
                accounts
                    .position
                    .close(accounts.sol_destination.to_account_info())?;
            }
        }

        Ok(())
    }
}
