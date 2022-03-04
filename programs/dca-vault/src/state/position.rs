use crate::common::ErrorCode::CannotGetPositionBump;
use anchor_lang::prelude::*;

use super::traits::ByteSized;

#[account]
#[derive(Default)]
pub struct Position {
    // The position authority NFT mint
    pub position_authority: Pubkey,

    // Total deposited
    pub deposited_token_a_amount: u64,

    // Total withdrawn B
    pub withdrawn_token_b_amount: u64,

    // The A/B/G vault the position belongs to
    pub vault: Pubkey,

    pub deposit_timestamp: i64,

    // The DCA period ID of the vault that happened prior to the user opening this position
    pub dca_period_id_before_deposit: u64,

    // Number of DCAs/Swaps that this position will be a part of
    pub number_of_swaps: u64,

    // deposit_amount_token_a / number_of_swaps
    pub periodic_drip_amount: u64,

    pub is_closed: bool,

    pub bump: u8,
}

impl Position {
    pub fn init(
        &mut self,
        vault: Pubkey,
        position_nft: Pubkey,
        deposited_amount: u64,
        last_dca_period: u64,
        dca_cycles: u64,
        periodic_drip_amount: u64,
        bump: Option<&u8>,
    ) -> Result<()> {
        self.vault = vault;
        self.position_authority = position_nft;
        self.deposited_token_a_amount = deposited_amount;
        self.withdrawn_token_b_amount = 0;
        self.deposit_timestamp = Clock::get().unwrap().unix_timestamp;
        self.dca_period_id_before_deposit = last_dca_period;
        self.number_of_swaps = dca_cycles;
        self.periodic_drip_amount = periodic_drip_amount;
        self.is_closed = false;
        match bump {
            Some(val) => {
                self.bump = *val;
                Ok(())
            }
            None => Err(CannotGetPositionBump.into()),
        }
    }

    pub fn get_withdrawable_amount(&self, max_withdrawable_token_b_amount: u64) -> u64 {
        max_withdrawable_token_b_amount
            .checked_sub(self.withdrawn_token_b_amount)
            .unwrap()
    }

    pub fn update_withdrawn_amount(&mut self, withdrawing_amount: u64) {
        self.withdrawn_token_b_amount = self
            .withdrawn_token_b_amount
            .checked_add(withdrawing_amount)
            .unwrap();
    }
}

impl ByteSized for Position {}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn sanity_check_byte_size() {
        assert_eq!(Position::byte_size(), 120);
    }
}
