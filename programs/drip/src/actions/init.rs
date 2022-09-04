use crate::errors::DripError;
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
                    return Err(DripError::InvalidGranularity.into());
                }
                if params.token_a_drip_trigger_spread >= 5000
                    || params.token_b_withdrawal_spread >= 5000
                {
                    return Err(DripError::InvalidSpread.into());
                }
                Ok(())
            }
            Init::VaultPeriod {
                accounts, params, ..
            } => {
                // Relation Checks
                if accounts.vault_proto_config.key() != accounts.vault.proto_config {
                    return Err(DripError::InvalidVaultProtoConfigReference.into());
                }
                // Business Checks
                // TODO(Mocha): do we even need this for init_vault_period?
                if !(params.period_id > accounts.vault.last_drip_period
                    || (params.period_id == 0 && accounts.vault.last_drip_period == 0))
                {
                    return Err(
                        DripError::CannotInitializeVaultPeriodLessThanVaultCurrentPeriod.into(),
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state;
    use crate::Init::VaultProtoConfig;
    use std::cell::RefCell;
    use std::rc::Rc;

    //  TODO: clean this up
    #[test]
    fn test_init_vault_proto_config() {
        let key: Pubkey = Default::default();
        let mut lamports: u64 = 1;
        let owner: Pubkey = Default::default();
        let default_account_info = &AccountInfo {
            key: &key,
            is_signer: false,
            is_writable: false,
            lamports: Rc::new(RefCell::new(&mut lamports)),
            data: Rc::new(RefCell::new(&mut [])),
            owner: &owner,
            executable: false,
            rent_epoch: 0,
        };

        let mut signer_account = default_account_info.clone();
        signer_account.is_signer = true;

        let mut system_program_account = default_account_info.clone();
        system_program_account.executable = true;

        let mut vault_proto_config_account = default_account_info.clone();

        let vault_proto_config_key: Pubkey = Pubkey::new_unique();
        vault_proto_config_account.key = &vault_proto_config_key;

        let vault_proto_config_data: state::VaultProtoConfig = state::VaultProtoConfig {
            granularity: 0,
            token_a_drip_trigger_spread: 0,
            token_b_withdrawal_spread: 0,
            admin: Default::default(),
        };
        let mut buf = Vec::new();
        vault_proto_config_data.try_serialize(&mut buf).unwrap();
        vault_proto_config_account.data = Rc::new(RefCell::new(&mut buf));

        vault_proto_config_account.owner = &crate::ID;

        let initialize_vault_proto_config_accounts = &mut InitializeVaultProtoConfigAccounts {
            creator: Signer::try_from(&signer_account).unwrap(),
            vault_proto_config: Account::try_from(&vault_proto_config_account).unwrap(),
            system_program: Program::try_from(&system_program_account).unwrap(),
        };

        let initialize_vault_proto_config_params = InitializeVaultProtoConfigParams {
            granularity: 0,
            token_a_drip_trigger_spread: 0,
            token_b_withdrawal_spread: 0,
            admin: Default::default(),
        };

        let vault_proto_config_action = VaultProtoConfig {
            accounts: initialize_vault_proto_config_accounts,
            params: initialize_vault_proto_config_params,
        };
        let res = vault_proto_config_action.validate();
        assert_eq!(res, Err(DripError::InvalidGranularity.into()));
    }
}
