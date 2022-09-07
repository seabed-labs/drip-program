use crate::errors::DripError::{
    CannotInitializeVaultPeriodLessThanVaultCurrentPeriod, InvalidGranularity, InvalidSpread,
    InvalidVaultProtoConfigReference,
};
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
                validate!(params.granularity > 0, InvalidGranularity);
                validate!(
                    params.token_a_drip_trigger_spread < MAX_TOKEN_SPREAD_EXCLUSIVE
                        && params.token_b_withdrawal_spread < MAX_TOKEN_SPREAD_EXCLUSIVE
                        && params.token_b_referral_spread < MAX_TOKEN_SPREAD_EXCLUSIVE,
                    InvalidSpread
                );
                Ok(())
            }
            Init::VaultPeriod {
                accounts, params, ..
            } => {
                // Relation Checks
                validate!(
                    accounts.vault_proto_config.key() == accounts.vault.proto_config,
                    InvalidVaultProtoConfigReference
                );
                // Business Checks
                // TODO(Mocha): do we even need this for init_vault_period?
                validate!(
                    params.period_id > accounts.vault.last_drip_period
                        || (params.period_id == 0 && accounts.vault.last_drip_period == 0),
                    CannotInitializeVaultPeriodLessThanVaultCurrentPeriod
                );
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
        params.token_b_referral_spread,
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
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state;
    use crate::Init::VaultProtoConfig;
    use test_case::test_case;

    //  TODO: clean this up
    #[test_case(0, 0, 0, 0, Pubkey::new_unique(), Err(InvalidGranularity.into()); "Returns error for invalid granularity")]
    #[test_case(1, 5001, 0, 0, Pubkey::new_unique(), Err(InvalidSpread.into()); "Returns error for invalid token_a_drip_trigger_spread")]
    #[test_case(1, 10, 5001, 0, Pubkey::new_unique(), Err(InvalidSpread.into()); "Returns error for invalid token_b_withdrawal_spread")]
    #[test_case(1, 10, 10, 5001, Pubkey::new_unique(), Err(InvalidSpread.into()); "Returns error for invalid token_b_referral_spread")]
    #[test_case(1, 10, 10, 10, Pubkey::new_unique(), Ok(()) ; "Returns ok for valid params")]
    fn vault_proto_config_validate(
        granularity: u64,
        token_a_drip_trigger_spread: u16,
        token_b_withdrawal_spread: u16,
        token_b_referral_spread: u16,
        admin: Pubkey,
        expected_res: Result<()>,
    ) {
        let signer = Pubkey::new_unique();
        let system_program: Pubkey = System::id();
        let vault_proto_config = Pubkey::new_unique();
        let l1 = &mut 1;
        let l2 = &mut 1;
        let l3 = &mut 1;
        let d1 = &mut [0u8];
        let d2 = &mut [0u8];
        let mut buf = {
            let vault_proto_config_data: state::VaultProtoConfig = state::VaultProtoConfig {
                granularity: 0,
                token_a_drip_trigger_spread: 0,
                token_b_withdrawal_spread: 0,
                token_b_referral_spread: 0,
                admin: Default::default(),
            };
            let mut buf: Vec<u8> = Vec::new();
            vault_proto_config_data.try_serialize(&mut buf).unwrap();
            buf
        };
        let d3 = buf.as_mut_slice();
        let signer_account =
            AccountInfo::new(&signer, true, false, l1, d1, &system_program, false, 0);
        let system_program_account = AccountInfo::new(
            &system_program,
            false,
            false,
            l2,
            d2,
            &system_program,
            true,
            0,
        );
        let vault_proto_config_account = AccountInfo::new(
            &vault_proto_config,
            false,
            false,
            l3,
            d3,
            &crate::ID,
            false,
            0,
        );

        let initialize_vault_proto_config_accounts = &mut InitializeVaultProtoConfigAccounts {
            creator: Signer::try_from(&signer_account).unwrap(),
            vault_proto_config: Account::try_from(&vault_proto_config_account).unwrap(),
            system_program: Program::try_from(&system_program_account).unwrap(),
        };

        let initialize_vault_proto_config_params = InitializeVaultProtoConfigParams {
            granularity,
            token_a_drip_trigger_spread,
            token_b_withdrawal_spread,
            token_b_referral_spread,
            admin,
        };

        let vault_proto_config_action = VaultProtoConfig {
            accounts: initialize_vault_proto_config_accounts,
            params: initialize_vault_proto_config_params,
        };
        let res = vault_proto_config_action.validate();
        assert_eq!(res, expected_res);
    }
}
