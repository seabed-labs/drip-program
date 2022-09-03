use crate::errors::ErrorCode;
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
    UpdateVaultWhitelistedSwaps {
        accounts: &'a mut UpdateVaultWhitelistedSwapsAccounts<'info>,
        params: UpdateVaultWhitelistedSwapsParams,
    },
}

impl<'a, 'info> Validatable for Admin<'a, 'info> {
    fn validate(&self) -> Result<()> {
        match self {
            Admin::InitVault {
                accounts, params, ..
            } => {
                // Relation Checks
                if accounts.creator.key() != accounts.vault_proto_config.admin {
                    // TODO: change to SignerIsNotAdmin
                    return Err(ErrorCode::OnlyAdminCanInitVault.into());
                }
                if accounts.token_a_account.mint != accounts.token_a_mint.key() {
                    return Err(ErrorCode::InvalidMint.into());
                }
                if accounts.token_b_account.mint != accounts.token_b_mint.key() {
                    return Err(ErrorCode::InvalidMint.into());
                }
                if accounts.treasury_token_b_account.mint != accounts.token_b_mint.key() {
                    return Err(ErrorCode::InvalidMint.into());
                }
                // Business Checks
                if accounts.treasury_token_b_account.state != AccountState::Initialized {
                    return Err(UninitializedAccount.into());
                }
                if params.whitelisted_swaps.len() > 5 {
                    return Err(ErrorCode::InvalidNumSwaps.into());
                }
                if params.max_slippage_bps == 0 || params.max_slippage_bps >= 10_000 {
                    return Err(ErrorCode::InvalidVaultMaxSlippage.into());
                }
                Ok(())
            }
            Admin::UpdateVaultWhitelistedSwaps {
                accounts, params, ..
            } => {
                // Relation Checks
                if accounts.admin.key() != accounts.vault_proto_config.admin {
                    return Err(ErrorCode::SignerIsNotAdmin.into());
                }
                if accounts.vault_proto_config.key() != accounts.vault.proto_config {
                    return Err(ErrorCode::InvalidVaultProtoConfigReference.into());
                }
                // Business Checks
                if params.whitelisted_swaps.len() > 5 {
                    return Err(ErrorCode::InvalidNumSwaps.into());
                }
                Ok(())
            }
        }
    }
}

impl<'a, 'info> Executable for Admin<'a, 'info> {
    fn execute(self) -> Result<()> {
        match self {
            Admin::InitVault {
                accounts,
                params,
                bumps,
            } => init_vault(accounts, params, bumps),
            Admin::UpdateVaultWhitelistedSwaps { accounts, params } => {
                update_vault_whitelisted_swaps(accounts, params)
            }
        }
    }
}

fn init_vault(
    accounts: &mut InitializeVaultAccounts,
    params: InitializeVaultParams,
    bumps: BTreeMap<String, u8>,
) -> Result<()> {
    let mut whitelisted_swaps: [Pubkey; 5] = Default::default();
    for (i, s) in params.whitelisted_swaps.iter().enumerate() {
        whitelisted_swaps[i] = *s;
    }
    accounts.vault.init(
        accounts.vault_proto_config.key(),
        accounts.token_a_mint.key(),
        accounts.token_b_mint.key(),
        accounts.token_a_account.key(),
        accounts.token_b_account.key(),
        accounts.treasury_token_b_account.key(),
        whitelisted_swaps,
        !params.whitelisted_swaps.is_empty(),
        params.max_slippage_bps,
        accounts.vault_proto_config.granularity,
        bumps.get("vault"),
    )?;

    msg!("Initialized Vault");
    Ok(())
}

fn update_vault_whitelisted_swaps(
    accounts: &mut UpdateVaultWhitelistedSwapsAccounts,
    params: UpdateVaultWhitelistedSwapsParams,
) -> Result<()> {
    let should_limit_swaps = !params.whitelisted_swaps.is_empty();
    let mut whitelisted_swaps: [Pubkey; 5] = Default::default();
    for (i, s) in params.whitelisted_swaps.iter().enumerate() {
        whitelisted_swaps[i] = *s;
    }
    accounts
        .vault
        .update_whitelisted_swaps(whitelisted_swaps, should_limit_swaps);
    Ok(())
}
