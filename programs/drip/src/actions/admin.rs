use crate::errors::ErrorCode;
use crate::{
    instruction_accounts::{InitializeVaultAccounts, InitializeVaultParams},
    state::traits::{Executable, Validatable},
};
use anchor_lang::prelude::*;
use std::collections::BTreeMap;

pub enum Admin<'a, 'info> {
    InitVault {
        accounts: &'a mut InitializeVaultAccounts<'info>,
        params: InitializeVaultParams,
        bumps: BTreeMap<String, u8>,
    },
}

impl<'a, 'info> Validatable for Admin<'a, 'info> {
    fn validate(&self) -> Result<()> {
        match self {
            Admin::InitVault { params, .. } => {
                if params.whitelisted_swaps.len() > 5 {
                    return Err(ErrorCode::InvalidNumSwaps.into());
                }

                if params.max_slippage_bps == 0 || params.max_slippage_bps >= 10_000 {
                    return Err(ErrorCode::InvalidVaultMaxSlippage.into());
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
