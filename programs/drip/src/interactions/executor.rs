use crate::state::traits::{CPI, PDA};
use anchor_lang::prelude::*;

pub trait CpiExecutor {
    fn execute_all(&mut self, cpis: Vec<&Option<&dyn CPI>>, signer: &dyn PDA) -> Result<()>;
}

pub struct RealCpiExecutor;

impl CpiExecutor for RealCpiExecutor {
    fn execute_all(&mut self, mut cpis: Vec<&Option<&dyn CPI>>, signer: &dyn PDA) -> Result<()> {
        cpis.drain(..).try_for_each(|cpi| {
            if let Some(cpi) = cpi {
                cpi.execute(signer)
            } else {
                Ok(())
            }
        })
    }
}

#[cfg(test)]
pub mod test {
    use super::*;

    pub struct TestCpiExecutor {
        pub cpi_executions: Vec<(String, String)>,
    }

    impl CpiExecutor for TestCpiExecutor {
        fn execute_all(
            &mut self,
            mut cpis: Vec<&Option<&dyn CPI>>,
            signer: &dyn PDA,
        ) -> Result<()> {
            cpis.drain(..).for_each(|cpi| {
                if let Some(cpi) = cpi {
                    self.cpi_executions.push((cpi.id(), signer.id()));
                }
            });

            Ok(())
        }
    }
}
