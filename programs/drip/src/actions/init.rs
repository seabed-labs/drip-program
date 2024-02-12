use crate::errors::DripError::{InvalidGranularity, InvalidSpread};
use crate::instruction_accounts::InitializeVaultPeriodAccountsBumps;
use crate::interactions::executor::CpiExecutor;
use crate::state::MAX_TOKEN_SPREAD_EXCLUSIVE;
use crate::{
    instruction_accounts::{
        InitializeVaultPeriodAccounts, InitializeVaultPeriodParams,
        InitializeVaultProtoConfigAccounts, InitializeVaultProtoConfigParams,
    },
    state::traits::{Executable, Validatable},
    validate,
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
        bumps: InitializeVaultPeriodAccountsBumps,
    },
}

impl<'a, 'info> Validatable for Init<'a, 'info> {
    fn validate(&self) -> Result<()> {
        match self {
            Init::VaultProtoConfig { params, .. } => {
                validate!(params.granularity > 0, InvalidGranularity);
                validate!(
                    params.token_a_drip_trigger_spread < MAX_TOKEN_SPREAD_EXCLUSIVE
                        && params.token_b_withdrawal_spread < MAX_TOKEN_SPREAD_EXCLUSIVE
                        && params.token_b_referral_spread < MAX_TOKEN_SPREAD_EXCLUSIVE,
                    InvalidSpread
                );
                Ok(())
            }
            Init::VaultPeriod { .. } => Ok(()),
        }
    }
}

impl<'a, 'info> Executable for Init<'a, 'info> {
    fn execute(self, _cpi_executer: &mut impl CpiExecutor) -> Result<()> {
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
        params.token_b_referral_spread,
        params.admin,
    );
    Ok(())
}

fn init_vault_period(
    accounts: &mut InitializeVaultPeriodAccounts,
    params: InitializeVaultPeriodParams,
    bumps: InitializeVaultPeriodAccountsBumps,
) -> Result<()> {
    accounts
        .vault_period
        .init(accounts.vault.key(), params.period_id, bumps.vault_period);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::interactions::executor::test::TestCpiExecutor;
    use crate::test::fixtures::{
        ADMIN, EMPTY_VAULT_PERIOD, EMPTY_VAULT_PROTO_CONFIG, SYSTEM_PROGRAM, VAULT,
    };
    use crate::Init;
    use std::convert::TryFrom;
    use test_case::test_case;

    #[test_case(0, 0, 0, 0, Pubkey::new_unique(), Err(InvalidGranularity.into()); "Returns error for invalid granularity")]
    #[test_case(1, 5001, 0, 0, Pubkey::new_unique(), Err(InvalidSpread.into()); "Returns error for invalid token_a_drip_trigger_spread")]
    #[test_case(1, 10, 5001, 0, Pubkey::new_unique(), Err(InvalidSpread.into()); "Returns error for invalid token_b_withdrawal_spread")]
    #[test_case(1, 10, 10, 5001, Pubkey::new_unique(), Err(InvalidSpread.into()); "Returns error for invalid token_b_referral_spread")]
    #[test_case(1, 10, 10, 10, Pubkey::new_unique(), Ok(()) ; "Returns ok for valid params")]
    fn init_vault_proto_config_validate(
        granularity: u64,
        token_a_drip_trigger_spread: u16,
        token_b_withdrawal_spread: u16,
        token_b_referral_spread: u16,
        admin: Pubkey,
        expected_res: Result<()>,
    ) {
        let mut signer = ADMIN.clone();
        let mut system_program = SYSTEM_PROGRAM.clone();
        let mut vault_proto_config = EMPTY_VAULT_PROTO_CONFIG.clone();

        let creator_account_info = &signer.to_account_info();
        let creator = Signer::try_from(creator_account_info).unwrap();
        let vault_proto_config_account_info = &vault_proto_config.to_account_info();
        let vault_proto_config = Account::try_from(vault_proto_config_account_info).unwrap();
        let system_program_account_info = &system_program.to_account_info();
        let system_program = Program::try_from(system_program_account_info).unwrap();

        let initialize_vault_proto_config_accounts = &mut InitializeVaultProtoConfigAccounts {
            creator,
            vault_proto_config,
            system_program,
        };

        let initialize_vault_proto_config_params = InitializeVaultProtoConfigParams {
            granularity,
            token_a_drip_trigger_spread,
            token_b_withdrawal_spread,
            token_b_referral_spread,
            admin,
        };

        let vault_proto_config_action = Init::VaultProtoConfig {
            accounts: initialize_vault_proto_config_accounts,
            params: initialize_vault_proto_config_params,
        };
        let res = vault_proto_config_action.validate();
        assert_eq!(res, expected_res);
    }

    #[test]
    fn init_vault_proto_config_happy_path() {
        let mut signer = ADMIN.clone();
        let mut system_program = SYSTEM_PROGRAM.clone();
        let mut vault_proto_config = EMPTY_VAULT_PROTO_CONFIG.clone();

        let creator_account_info = &signer.to_account_info();
        let creator = Signer::try_from(creator_account_info).unwrap();
        let vault_proto_config_account_info = &vault_proto_config.to_account_info();
        let vault_proto_config = Account::try_from(vault_proto_config_account_info).unwrap();
        let system_program_account_info = &system_program.to_account_info();
        let system_program = Program::try_from(system_program_account_info).unwrap();

        let mut initialize_vault_proto_config_accounts = InitializeVaultProtoConfigAccounts {
            creator,
            vault_proto_config,
            system_program,
        };

        let vault_proto_config_before = &initialize_vault_proto_config_accounts.vault_proto_config;

        assert_eq!(vault_proto_config_before.granularity, 0);
        assert_eq!(vault_proto_config_before.token_a_drip_trigger_spread, 0);
        assert_eq!(vault_proto_config_before.token_b_withdrawal_spread, 0);
        assert_eq!(vault_proto_config_before.token_b_referral_spread, 0);
        assert_eq!(vault_proto_config_before.admin, Default::default());

        let admin = Pubkey::new_unique();

        let initialize_vault_proto_config_params = InitializeVaultProtoConfigParams {
            granularity: 1,
            token_a_drip_trigger_spread: 2,
            token_b_withdrawal_spread: 3,
            token_b_referral_spread: 4,
            admin,
        };

        let vault_proto_config_action = Init::VaultProtoConfig {
            accounts: &mut initialize_vault_proto_config_accounts,
            params: initialize_vault_proto_config_params,
        };

        let res = vault_proto_config_action.validate();
        assert_eq!(res, Ok(()));

        let mut cpi_executor = TestCpiExecutor {
            cpi_calls: vec![],
            signer: None,
        };

        let res = vault_proto_config_action.execute(&mut cpi_executor);
        assert_eq!(res, Ok(()));

        assert_eq!(cpi_executor.cpi_calls, vec![]);

        let vault_proto_config_after = &initialize_vault_proto_config_accounts.vault_proto_config;

        assert_eq!(vault_proto_config_after.granularity, 1);
        assert_eq!(vault_proto_config_after.token_a_drip_trigger_spread, 2);
        assert_eq!(vault_proto_config_after.token_b_withdrawal_spread, 3);
        assert_eq!(vault_proto_config_after.token_b_referral_spread, 4);
        assert_eq!(vault_proto_config_after.admin, admin);
    }

    #[test]
    fn init_vault_period_happy_path<'a>() {
        let mut signer = ADMIN.clone();
        let mut system_program = SYSTEM_PROGRAM.clone();
        let mut vault = VAULT.clone();
        let mut vault_period = EMPTY_VAULT_PERIOD.clone();

        let creator_account_info = &signer.to_account_info();
        let creator = Signer::try_from(creator_account_info).unwrap();

        let vault_period_account_info = &vault_period.to_account_info();
        let vault_period = Account::try_from(vault_period_account_info).unwrap();

        let vault_account_info = &vault.to_account_info();
        let vault = Account::try_from(vault_account_info).unwrap();

        let system_program_account_info = &system_program.to_account_info();
        let system_program = Program::try_from(system_program_account_info).unwrap();
        let mut initialize_vault_period_accounts = InitializeVaultPeriodAccounts {
            vault_period,
            vault,
            creator,
            system_program,
        };

        let vault_period_before = &initialize_vault_period_accounts.vault_period;
        assert_eq!(vault_period_before.vault, Default::default());
        assert_eq!(vault_period_before.period_id, 0);
        assert_eq!(vault_period_before.drip_timestamp, 0);
        assert_eq!(vault_period_before.dar, 0);
        assert_eq!(vault_period_before.twap, 0);
        assert_eq!(vault_period_before.bump, 0);

        let initialize_vault_period_params = InitializeVaultPeriodParams { period_id: 1 };

        let vault_proto_config_action = Init::VaultPeriod {
            accounts: &mut initialize_vault_period_accounts,
            params: initialize_vault_period_params,
            bumps: InitializeVaultPeriodAccountsBumps { vault_period: 5 },
        };

        let res = vault_proto_config_action.validate();
        assert_eq!(res, Ok(()));

        let mut cpi_executor = TestCpiExecutor {
            cpi_calls: vec![],
            signer: None,
        };

        let res = vault_proto_config_action.execute(&mut cpi_executor);
        assert_eq!(res, Ok(()));

        assert_eq!(cpi_executor.cpi_calls, vec![]);

        let vault_period_after = &initialize_vault_period_accounts.vault_period;
        assert_ne!(
            initialize_vault_period_accounts.vault.key(),
            Default::default()
        );
        assert_eq!(
            vault_period_after.vault,
            initialize_vault_period_accounts.vault.key()
        );
        assert_eq!(vault_period_after.period_id, 1);
        assert_eq!(vault_period_after.drip_timestamp, 0);
        assert_eq!(vault_period_after.dar, 0);
        assert_eq!(vault_period_after.twap, 0);
        assert_eq!(vault_period_after.bump, 5);
    }
}
