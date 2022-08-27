use anchor_lang::prelude::*;

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
    fn execute(self, signer: &impl PDA) -> Result<()>;
}
