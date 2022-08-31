use crate::state::traits::{Executable, Validatable};
use crate::{ClosePositionAccounts, WithdrawBAccounts};
use anchor_lang::prelude::*;

pub enum Withdraw<'a, 'info> {
    ClosePosition {
        accounts: &'a mut ClosePositionAccounts<'info>,
    },
    WithdrawB {
        accounts: &'a mut WithdrawBAccounts<'info>,
    },
}

impl<'a, 'info> Validatable for Withdraw<'a, 'info> {
    fn validate(&self) -> Result<()> {
        match self {
            Withdraw::ClosePosition { .. } => todo!(),
            Withdraw::WithdrawB { .. } => todo!(),
        }
    }
}

impl<'a, 'info> Executable for Withdraw<'a, 'info> {
    fn execute(self) -> Result<()> {
        match self {
            Withdraw::ClosePosition { accounts } => close_position(accounts),
            Withdraw::WithdrawB { accounts } => withdraw_b(accounts),
        }
    }
}

fn close_position(_accounts: &mut ClosePositionAccounts) -> Result<()> {
    todo!()
}

fn withdraw_b(_accounts: &mut WithdrawBAccounts) -> Result<()> {
    todo!()
}
