use crate::state::traits::{CPI, PDA};
use anchor_lang::prelude::*;

pub struct Empty {}

impl Empty {
    pub fn new() -> Self {
        Empty {}
    }
}

impl CPI for Empty {
    fn execute(self, _signer: &impl PDA) -> Result<()> {
        Ok(())
    }
}
