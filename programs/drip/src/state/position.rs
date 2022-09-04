use crate::{errors::DripError::CannotGetPositionBump, test_account_size};
use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Position {
    // The A/B/G vault the position belongs to
    pub vault: Pubkey, // 32
    // The position authority NFT mint
    pub position_authority: Pubkey, // 32
    // Total deposited
    pub deposited_token_a_amount: u64, // 8
    // Total withdrawn B (amount sent to the user + amount sent to the treasury)
    pub withdrawn_token_b_amount: u64, // 8
    pub deposit_timestamp: i64,        // 8
    // The drip period ID of the vault that happened prior to the user opening this position
    pub drip_period_id_before_deposit: u64, // 8
    // Number of drips/Swaps that this position will be a part of
    pub number_of_swaps: u64, // 8
    // deposit_amount_token_a / number_of_swaps
    pub periodic_drip_amount: u64, // 8
    pub is_closed: bool,           // 1
    pub bump: u8,                  // 1
}

impl Position {
    // total space -> 114
    // allocation needed: ceil( (114+8)/8 )*8 -> 128
    pub const ACCOUNT_SPACE: usize = 128;

    pub fn init(
        &mut self,
        vault: Pubkey,
        position_nft: Pubkey,
        deposited_amount: u64,
        last_drip_period: u64,
        number_of_swaps: u64,
        periodic_drip_amount: u64,
        bump: Option<&u8>,
    ) -> Result<()> {
        self.vault = vault;
        self.position_authority = position_nft;
        self.deposited_token_a_amount = deposited_amount;
        self.withdrawn_token_b_amount = 0;
        self.deposit_timestamp = Clock::get().unwrap().unix_timestamp;
        self.drip_period_id_before_deposit = last_drip_period;
        self.number_of_swaps = number_of_swaps;
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

    pub fn get_withdrawable_amount_with_max(&self, max_withdrawable_token_b_amount: u64) -> u64 {
        max_withdrawable_token_b_amount
            .checked_sub(self.withdrawn_token_b_amount)
            .unwrap()
    }

    pub fn increase_withdrawn_amount(&mut self, amount: u64) {
        self.withdrawn_token_b_amount = self.withdrawn_token_b_amount.checked_add(amount).unwrap();
    }

    pub fn close(&mut self) {
        self.is_closed = true;
    }
}

test_account_size!(Position);
