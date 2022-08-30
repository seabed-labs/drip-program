use anchor_lang::prelude::*;

use crate::{
    instruction_accounts::deposit::{DepositAccounts, DepositParams, DepositWithMetadataAccounts},
    state::traits::Execute,
};

pub enum Deposit<'a, 'info> {
    WithoutMetadata {
        accounts: &'a mut DepositAccounts<'info>,
        params: DepositParams,
    },
    WithMetadata {
        accounts: &'a mut DepositWithMetadataAccounts<'info>,
        params: DepositParams,
    },
}

impl<'a, 'info> Execute for Deposit<'a, 'info> {
    fn execute(self) -> Result<()> {
        match self {
            Deposit::WithoutMetadata { accounts, params } => {
                deposit_without_metadata(accounts, params)
            }
            Deposit::WithMetadata { accounts, params } => deposit_with_metadata(accounts, params),
        }
    }
}

// At this point, we can have them take whatever code path needed and can arbitrarily share code paths between multiple flows of the same action
// Think of an action as a higher level construct that encompasses all instruction variants

fn deposit_without_metadata(_accounts: &mut DepositAccounts, _params: DepositParams) -> Result<()> {
    todo!()
}

fn deposit_with_metadata(
    _accounts: &mut DepositWithMetadataAccounts,
    _params: DepositParams,
) -> Result<()> {
    todo!()
}
