use anchor_lang::prelude::*;

use crate::common::ErrorCode::CannotGetVaultBump;

use super::traits::ByteSized;

#[account]
#[derive(Default)]
pub struct Vault {
    // Account relations
    pub proto_config: Pubkey,
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    pub token_a_account: Pubkey,
    pub token_b_account: Pubkey,

    // Data
    pub last_dca_period: u64, // 1 to N
    pub drip_amount: u64,
    pub dca_activation_timestamp: i64,
    pub bump: u8,
}

impl Vault {
    pub fn init(
        &mut self,
        proto_config: Pubkey,
        token_a_mint: Pubkey,
        token_b_mint: Pubkey,
        token_a_account: Pubkey,
        token_b_account: Pubkey,
        granularity: u64,
        bump: Option<&u8>,
    ) -> Result<()> {
        self.proto_config = proto_config;
        self.token_a_mint = token_a_mint;
        self.token_b_mint = token_b_mint;
        self.token_a_account = token_a_account;
        self.token_b_account = token_b_account;
        self.last_dca_period = 0;
        self.drip_amount = 0;

        let now = Clock::get().unwrap().unix_timestamp;
        // TODO(matcha): Abstract away this date flooring math and add unit tests
        // TODO(matcha): Figure out how to test this on integration tests without replicating the logic
        self.dca_activation_timestamp = now - now % granularity as i64;

        match bump {
            Some(val) => {
                self.bump = *val;
                Ok(())
            }
            None => Err(CannotGetVaultBump.into()),
        }
    }

    pub fn increase_drip_amount(&mut self, extra_drip: u64) {
        self.drip_amount += extra_drip;
    }
}

impl ByteSized for Vault {}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn sanity_check_byte_size() {
        assert_eq!(Vault::byte_size(), 192);
    }
}
