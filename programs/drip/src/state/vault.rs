use super::traits::ByteSized;
use crate::errors::ErrorCode::CannotGetVaultBump;
use crate::state::VaultPeriod;
use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Vault {
    // Account relations
    pub proto_config: Pubkey,
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    pub token_a_account: Pubkey,
    pub token_b_account: Pubkey,
    pub treasury_token_b_account: Pubkey,
    pub whitelisted_swaps: [Pubkey; 5],
    pub limit_swaps: bool,

    // Data
    pub last_dca_period: u64, // 1 to N
    pub drip_amount: u64,
    pub dca_activation_timestamp: i64,
    pub bump: u8,
}

impl<'info> Vault {
    pub fn init(
        &mut self,
        proto_config: Pubkey,
        token_a_mint: Pubkey,
        token_b_mint: Pubkey,
        token_a_account: Pubkey,
        token_b_account: Pubkey,
        treasury_token_b_account: Pubkey,
        whitelisted_swaps: [Pubkey; 5],
        limit_swaps: bool,
        granularity: u64,
        bump: Option<&u8>,
    ) -> Result<()> {
        self.proto_config = proto_config;
        self.token_a_mint = token_a_mint;
        self.token_b_mint = token_b_mint;
        self.token_a_account = token_a_account;
        self.token_b_account = token_b_account;
        self.treasury_token_b_account = treasury_token_b_account;
        self.whitelisted_swaps = whitelisted_swaps;
        self.limit_swaps = limit_swaps;

        self.last_dca_period = 0;
        self.drip_amount = 0;

        let now = Clock::get().unwrap().unix_timestamp;
        // TODO(matcha): Abstract away this date flooring math and add unit tests
        // TODO(matcha): Figure out how to test this on integration tests without replicating the logic
        // TODO: Use checked_xyz
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
        self.drip_amount = self
            .drip_amount
            .checked_add(extra_drip)
            .expect("overflow drip amount");
    }

    pub fn decrease_drip_amount(&mut self, position_drip: u64) {
        self.drip_amount = self.drip_amount.checked_sub(position_drip).unwrap();
    }

    pub fn process_drip(&mut self, current_period: &Account<VaultPeriod>, granularity: u64) {
        self.drip_amount = self.drip_amount.checked_sub(current_period.dar).unwrap();
        self.last_dca_period = current_period.period_id;

        let now = Clock::get().unwrap().unix_timestamp;
        // TODO(matcha): Abstract away this date flooring math and add unit tests
        // TODO(matcha): Figure out how to test this on integration tests without replicating the logic
        // TODO: Use checked_xyz
        // TODO(matcha): Make sure this makes sense (think through it)
        self.dca_activation_timestamp = (now - now % granularity as i64) + granularity as i64;
    }

    pub fn is_dca_activated(&self) -> bool {
        let now = Clock::get().unwrap().unix_timestamp;
        now >= self.dca_activation_timestamp
    }

    pub fn seeds(&self) -> [&[u8]; 4] {
        [
            b"drip-v1".as_ref(),
            self.token_a_mint.as_ref(),
            self.token_b_mint.as_ref(),
            self.proto_config.as_ref(),
        ]
    }
}

impl ByteSized for Vault {}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn sanity_check_byte_size() {
        assert_eq!(Vault::byte_size(), 384);
    }
}
