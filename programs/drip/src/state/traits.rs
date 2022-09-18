use anchor_lang::prelude::*;

use crate::interactions::executor::{CpiExecutor, CpiIdentifier};

pub trait ByteSized
where
    Self: Sized,
{
    fn byte_size() -> usize {
        std::mem::size_of::<Self>()
    }
}

pub trait PDA {
    fn seeds(&self) -> Vec<&[u8]>;
    fn bump(&self) -> u8;
}

pub trait CPI {
    fn execute(&self, signer: &dyn PDA) -> Result<()>;
    fn id(&self) -> CpiIdentifier;
}

pub trait Validatable {
    fn validate(&self) -> Result<()>;
}

pub trait Executable {
    fn execute(self, cpi_executer: &mut impl CpiExecutor) -> Result<()>;
}
