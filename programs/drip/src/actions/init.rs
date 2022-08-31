use anchor_lang::prelude::*;

use crate::{
    instruction_accounts::{
        InitializeVaultPeriodAccounts, InitializeVaultPeriodParams,
        InitializeVaultProtoConfigAccounts, InitializeVaultProtoConfigParams,
    },
    state::traits::{Executable, Validatable},
};

pub enum Init<'a, 'info> {
    VaultProtoConfig {
        accounts: &'a mut InitializeVaultProtoConfigAccounts<'info>,
        params: InitializeVaultProtoConfigParams,
    },
    VaultPeriod {
        accounts: &'a mut InitializeVaultPeriodAccounts<'info>,
        params: InitializeVaultPeriodParams,
    },
}

impl<'a, 'info> Validatable for Init<'a, 'info> {
    fn validate(&self) -> Result<()> {
        match self {
            Init::VaultProtoConfig { .. } => todo!(),
            Init::VaultPeriod { .. } => todo!(),
        }
    }
}

impl<'a, 'info> Executable for Init<'a, 'info> {
    fn execute(self) -> Result<()> {
        match self {
            Init::VaultProtoConfig { accounts, params } => {
                init_vault_proto_config(accounts, params)
            }
            Init::VaultPeriod { accounts, params } => init_vault_period(accounts, params),
        }
    }
}

fn init_vault_proto_config(
    _accounts: &mut InitializeVaultProtoConfigAccounts,
    _params: InitializeVaultProtoConfigParams,
) -> Result<()> {
    todo!()
}

fn init_vault_period(
    _accounts: &mut InitializeVaultPeriodAccounts,
    _params: InitializeVaultPeriodParams,
) -> Result<()> {
    todo!()
}
