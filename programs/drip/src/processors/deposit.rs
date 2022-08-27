use anchor_lang::prelude::*;

use crate::{instruction_accounts::deposit::{DepositAccounts, DepositWithMetadataAccounts, DepositParams}, state::traits::Execute};

pub enum Deposit<'a, 'info> {
  WithoutMetadata { accounts: &'a mut DepositAccounts<'info>, params: DepositParams },
  WithMetadata { accounts: &'a mut DepositWithMetadataAccounts<'info>, params: DepositParams },
} 

impl<'a, 'info> Execute for Deposit<'a, 'info> {
    fn execute(self) -> Result<()> {
        todo!()
    }
}
