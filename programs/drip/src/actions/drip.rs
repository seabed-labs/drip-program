use anchor_lang::prelude::*;

use crate::{
    instruction_accounts::{DripOrcaWhirlpoolAccounts, DripSPLTokenSwapAccounts},
    state::traits::{Executable, Validatable},
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
            Drip::SPLTokenSwap { .. } => todo!(),
            Drip::OrcaWhirlpool { .. } => todo!(),
        }
    }
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
