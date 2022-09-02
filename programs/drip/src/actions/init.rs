use crate::errors::ErrorCode;
use crate::{
    instruction_accounts::{
        InitializeVaultPeriodAccounts, InitializeVaultPeriodParams,
        InitializeVaultProtoConfigAccounts, InitializeVaultProtoConfigParams,
    },
    state::traits::{Executable, Validatable},
};
use anchor_lang::prelude::*;
use std::collections::BTreeMap;

pub enum Init<'a, 'info> {
    VaultProtoConfig {
        accounts: &'a mut InitializeVaultProtoConfigAccounts<'info>,
        params: InitializeVaultProtoConfigParams,
    },
    VaultPeriod {
        accounts: &'a mut InitializeVaultPeriodAccounts<'info>,
        params: InitializeVaultPeriodParams,
        bumps: BTreeMap<String, u8>,
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
            Init::VaultPeriod {
                accounts, params, ..
            } => {
                // TODO(Mocha): do we even need this for init_vault_period?
                if !(params.period_id > accounts.vault.last_drip_period
                    || (params.period_id == 0 && accounts.vault.last_drip_period == 0))
                {
                    return Err(
                        ErrorCode::CannotInitializeVaultPeriodLessThanVaultCurrentPeriod.into(),
                    );
                }
                Ok(())
            }
        }
    }
}

impl<'a, 'info> Executable for Init<'a, 'info> {
    fn execute(self) -> Result<()> {
        match self {
            Init::VaultProtoConfig { accounts, params } => {
                init_vault_proto_config(accounts, params)
            }
            Init::VaultPeriod {
                accounts,
                params,
                bumps,
            } => init_vault_period(accounts, params, bumps),
        }
    }
}

fn init_vault_proto_config(
    accounts: &mut InitializeVaultProtoConfigAccounts,
    params: InitializeVaultProtoConfigParams,
) -> Result<()> {
    accounts.vault_proto_config.init(
        params.granularity,
        params.token_a_drip_trigger_spread,
        params.token_b_withdrawal_spread,
        params.admin,
    );
    Ok(())
}

fn init_vault_period(
    accounts: &mut InitializeVaultPeriodAccounts,
    params: InitializeVaultPeriodParams,
    bumps: BTreeMap<String, u8>,
) -> Result<()> {
    accounts.vault_period.init(
        accounts.vault.key(),
        params.period_id,
        bumps.get("vault_period"),
    )?;

    msg!("Initialized VaultPeriod");
    Ok(())
}
