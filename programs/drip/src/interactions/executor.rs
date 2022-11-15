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

#[derive(Debug, PartialEq, Eq)]
pub enum CpiIdentifier {
    MintToken {
        token_program: Pubkey,
        mint: Pubkey,
        to: Pubkey,
        authority: Pubkey,
        amount: u64,
    },
    TransferToken {
        token_program: Pubkey,
        from: Pubkey,
        to: Pubkey,
        authority: Pubkey,
        amount: u64,
    },
    BurnToken {
        token_program: Pubkey,
        mint: Pubkey,
        from: Pubkey,
        authority: Pubkey,
        amount: u64,
    },
    CreateTokenMetadata {
        metadata_program: Pubkey,
        system_program: Pubkey,
        metadata_account: Pubkey,
        mint: Pubkey,
        authority: Pubkey,
        payer: Pubkey,
        rent: Pubkey,
        metadata_uri: String,
        name: String,
        symbol: String,
    },
    CloseAccount {
        token_program: Pubkey,
        token_account: Pubkey,
        destination: Pubkey,
        authority: Pubkey,
    },
    SetMintAuthority {
        token_program: Pubkey,
        mint: Pubkey,
        current_authority: Pubkey,
        new_authority: Option<Pubkey>,
    },
    SwapOrcaWhirlpool {
        whirlpool_program: Pubkey,
        token_program: Pubkey,
        token_authority: Pubkey,
        whirlpool: Pubkey,
        token_owner_account_a: Pubkey,
        whirlpool_token_vault_a: Pubkey,
        token_owner_account_b: Pubkey,
        whirlpool_token_vault_b: Pubkey,
        tick_array_0: Pubkey,
        tick_array_1: Pubkey,
        tick_array_2: Pubkey,
        oracle: Pubkey,
        amount_in: u64,
        sqrt_price_limit: u128,
        a_to_b: bool,
    },
    SwapSPLTokenSwap {
        token_swap_program: Pubkey,
        token_program: Pubkey,
        token_swap: Pubkey,
        swap_authority: Pubkey,
        user_transfer_authority: Pubkey,
        user_token_a_account: Pubkey,
        swap_token_a_account: Pubkey,
        swap_token_b_account: Pubkey,
        user_token_b_account: Pubkey,
        swap_mint: Pubkey,
        swap_fee_account: Pubkey,
        amount_in: u64,
        minimum_out: u64,
    },
}

#[cfg(test)]
pub mod test {
    use crate::sign;

    use super::*;

    pub struct TestCpiExecutor {
        pub cpi_calls: Vec<CpiIdentifier>,
        pub signer: Option<Pubkey>,
    }

    impl CpiExecutor for TestCpiExecutor {
        fn execute_all(
            &mut self,
            mut cpis: Vec<&Option<&dyn CPI>>,
            signer: &dyn PDA,
        ) -> Result<()> {
            cpis.drain(..).for_each(|cpi| {
                if let Some(cpi) = cpi {
                    self.cpi_calls.push(cpi.id());
                }
            });

            self.signer = Some(Pubkey::create_program_address(sign!(signer), &crate::ID).unwrap());

            Ok(())
        }
    }
}
