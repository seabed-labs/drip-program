use anchor_lang::prelude::*;

use crate::{
    instruction_accounts::{
        InitializeVaultAccounts, InitializeVaultParams, InitializeVaultPeriodAccounts,
        InitializeVaultPeriodParams, InitializeVaultProtoConfigAccounts,
        InitializeVaultProtoConfigParams,
    },
    state::traits::Execute,
};

pub enum Init<'a, 'info> {
    VaultProtoConfig {
        accounts: &'a mut InitializeVaultProtoConfigAccounts<'info>,
        params: InitializeVaultProtoConfigParams,
    },
    Vault {
        accounts: &'a mut InitializeVaultAccounts<'info>,
        params: InitializeVaultParams,
    },
    VaultPeriod {
        accounts: &'a mut InitializeVaultPeriodAccounts<'info>,
        params: InitializeVaultPeriodParams,
    },
}

impl<'a, 'info> Execute for Init<'a, 'info> {
    fn execute(self) -> Result<()> {
        match self {
            Init::VaultProtoConfig { accounts, params } => {
                init_vault_proto_config(accounts, params)
            }
            Init::Vault { accounts, params } => init_vault(accounts, params),
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

fn init_vault(
    _accounts: &mut InitializeVaultAccounts,
    _params: InitializeVaultParams,
) -> Result<()> {
    todo!()
}

fn init_vault_period(
    _accounts: &mut InitializeVaultPeriodAccounts,
    _params: InitializeVaultPeriodParams,
) -> Result<()> {
    todo!()
}
