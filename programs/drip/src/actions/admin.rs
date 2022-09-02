use anchor_lang::prelude::*;

use crate::{
    instruction_accounts::{InitializeVaultAccounts, InitializeVaultParams},
    state::traits::{Executable, Validatable},
};

pub enum Admin<'a, 'info> {
    Vault {
        accounts: &'a mut InitializeVaultAccounts<'info>,
        params: InitializeVaultParams,
    },
}

impl<'a, 'info> Validatable for Admin<'a, 'info> {
    fn validate(&self) -> Result<()> {
        match self {
            Admin::Vault { .. } => todo!(),
        }
    }
}

impl<'a, 'info> Executable for Admin<'a, 'info> {
    fn execute(self) -> Result<()> {
        match self {
            Admin::Vault { accounts, params } => init_vault(accounts, params),
        }
    }
}

fn init_vault(
    _accounts: &mut InitializeVaultAccounts,
    _params: InitializeVaultParams,
) -> Result<()> {
    todo!()
}
