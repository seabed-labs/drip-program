use crate::errors::ErrorCode;
use crate::{
    instruction_accounts::{
        InitializeVaultPeriodAccounts, InitializeVaultPeriodParams,
        InitializeVaultProtoConfigAccounts, InitializeVaultProtoConfigParams,
    },
    state::traits::{Executable, Validatable},
};
use anchor_lang::prelude::*;

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
            Init::VaultProtoConfig { params, .. } => {
                if params.granularity == 0 {
                    return Err(ErrorCode::InvalidGranularity.into());
                }
                if params.token_a_drip_trigger_spread >= 5000
                    || params.token_b_withdrawal_spread >= 5000
                {
                    return Err(ErrorCode::InvalidSpread.into());
                }
                Ok(())
            }
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
