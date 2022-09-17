use crate::state::traits::{CPI, PDA};
use anchor_lang::prelude::*;

pub trait CpiExecutor {
    fn execute(&mut self, cpi: impl CPI, signer: &impl PDA) -> Result<()>;
}

pub struct RealCpiExecutor;

impl CpiExecutor for RealCpiExecutor {
    fn execute(&mut self, cpi: impl CPI, signer: &impl PDA) -> Result<()> {
        cpi.execute(signer)
    }
}

#[cfg(test)]
pub mod test {
    use super::*;

    pub struct TestCpiExecutor {
        pub cpi_executions: Vec<(String, String)>,
    }

    impl CpiExecutor for TestCpiExecutor {
        fn execute(&mut self, cpi: impl CPI, signer: &impl PDA) -> Result<()> {
            self.cpi_executions.push((cpi.id(), signer.id()));

            Ok(())
        }
    }
}
