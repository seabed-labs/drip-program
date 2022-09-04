use crate::state::traits::{Executable, Validatable};
use crate::{ClosePositionAccounts, WithdrawBAccounts};

use anchor_lang::prelude::*;

pub enum Withdraw<'a, 'info> {
    WithoutClosePosition {
        accounts: &'a mut WithdrawBAccounts<'info>,
    },
    WithClosePosition {
        accounts: &'a mut ClosePositionAccounts<'info>,
    },
}

impl<'a, 'info> Validatable for Withdraw<'a, 'info> {
    fn validate(&self) -> Result<()> {
        match self {
            Withdraw::WithoutClosePosition { .. } => todo!(),
            Withdraw::WithClosePosition { .. } => todo!(),
        }
    }
}

impl<'a, 'info> Executable for Withdraw<'a, 'info> {
    fn execute(self) -> Result<()> {
        match self {
            Withdraw::WithoutClosePosition { .. } => todo!(),
            Withdraw::WithClosePosition { .. } => todo!(),
        }
    }
}
