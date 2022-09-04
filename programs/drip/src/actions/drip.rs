use anchor_lang::prelude::*;

use crate::errors::DripError::{
    DuplicateDripError, InvalidOwner, InvalidSwapAccount, PeriodicDripAmountIsZero,
};

use crate::{
    instruction_accounts::{DripOrcaWhirlpoolAccounts, DripSPLTokenSwapAccounts},
    state::traits::{Executable, Validatable},
    validate, DripCommonAccounts,
};

pub enum Drip<'a, 'info> {
    SPLTokenSwap {
        accounts: &'a mut DripSPLTokenSwapAccounts<'info>,
    },
    OrcaWhirlpool {
        accounts: &'a mut DripOrcaWhirlpoolAccounts<'info>,
    },
}

impl<'a, 'info> Validatable for Drip<'a, 'info> {
    fn validate(&self) -> Result<()> {
        match self {
            Drip::SPLTokenSwap { accounts, .. } => {
                validate_common(&accounts.common, &accounts.swap.key())?;
                validate!(
                    accounts.common.swap_token_a_account.owner == accounts.swap.key(),
                    InvalidOwner
                );
                validate!(
                    accounts.common.swap_token_b_account.owner == accounts.swap.key(),
                    InvalidOwner
                );
                Ok(())
            }
            Drip::OrcaWhirlpool { accounts, .. } => {
                validate_common(&accounts.common, &accounts.whirlpool.key())?;
                // TODO: should we rename whirlpool to swap so we can normalize this more?
                validate!(
                    accounts.common.swap_token_a_account.owner == accounts.whirlpool.key(),
                    InvalidOwner
                );
                validate!(
                    accounts.common.swap_token_b_account.owner == accounts.whirlpool.key(),
                    InvalidOwner
                );
                Ok(())
            }
        }
    }
}

fn validate_common(accounts: &DripCommonAccounts, swap: &Pubkey) -> Result<()> {
    validate!(
        accounts.vault_token_a_account.amount > 0 && accounts.vault.drip_amount > 0,
        PeriodicDripAmountIsZero
    );
    validate!(accounts.vault.is_drip_activated(), DuplicateDripError);
    validate!(
        !accounts.vault.limit_swaps || accounts.vault.whitelisted_swaps.contains(swap),
        InvalidSwapAccount
    );
    Ok(())
}

impl<'a, 'info> Executable for Drip<'a, 'info> {
    fn execute(self) -> Result<()> {
        match self {
            Drip::SPLTokenSwap { accounts } => drip_spl_token_swap(accounts),
            Drip::OrcaWhirlpool { accounts } => drip_orca_whirlpool(accounts),
        }
    }
}

fn drip_spl_token_swap(_accounts: &mut DripSPLTokenSwapAccounts) -> Result<()> {
    todo!()
}

fn drip_orca_whirlpool(_accounts: &mut DripOrcaWhirlpoolAccounts) -> Result<()> {
    todo!()
}
