use anchor_lang::prelude::*;

use crate::interactions::executor::CpiExecutor;

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
    fn id(&self) -> String;
}

pub trait CPI {
    fn execute(&self, signer: &dyn PDA) -> Result<()>;
    fn id(&self) -> String;
}

pub trait Validatable {
    fn validate(&self) -> Result<()>;
}

pub trait Executable {
    fn execute(self, cpi_executer: &mut impl CpiExecutor) -> Result<()>;
}
