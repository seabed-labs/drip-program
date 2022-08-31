use anchor_lang::prelude::*;

use crate::{
    state::traits::{Executable, Validatable},
    UpdateVaultWhitelistedSwapsAccounts, UpdateVaultWhitelistedSwapsParams,
};

pub enum Admin<'a, 'info> {
    UpdateVaultWhitelistedSwaps {
        accounts: &'a mut UpdateVaultWhitelistedSwapsAccounts<'info>,
        params: UpdateVaultWhitelistedSwapsParams,
    },
}

impl<'a, 'info> Validatable for Admin<'a, 'info> {
    fn validate(&self) -> Result<()> {
        match self {
            Admin::UpdateVaultWhitelistedSwaps { .. } => todo!(),
        }
    }
}

impl<'a, 'info> Executable for Admin<'a, 'info> {
    fn execute(self) -> Result<()> {
        match self {
            Admin::UpdateVaultWhitelistedSwaps { accounts, params } => {
                update_vault_whitelisted_swaps(accounts, params)
            }
        }
    }
}

fn update_vault_whitelisted_swaps(
    _accounts: &mut UpdateVaultWhitelistedSwapsAccounts,
    _params: UpdateVaultWhitelistedSwapsParams,
) -> Result<()> {
    todo!()
}
