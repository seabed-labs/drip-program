use crate::math::{calculate_new_twap_amount, compute_price};
use crate::test_account_size;
use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct VaultPeriod {
    // Account relations
    pub vault: Pubkey, // 32

    // Data
    // The period index/offset from the genesis period of the vault (0, 1, ...)
    pub period_id: u64, // 8
    // Drip amount to reduce at this period
    pub dar: u64, // 8
    // Time weighted average price of asset A expressed in asset B from period 1 to this period
    pub twap: u128, // 16
    // Timestamp for the drip
    pub drip_timestamp: i64, //8
    // Bump
    pub bump: u8, // 1
}

impl VaultPeriod {
    // total space -> 73
    // allocation needed: ceil( (73+8)/8 )*8 -> 88
    pub const ACCOUNT_SPACE: usize = 88;

    pub fn init(&mut self, vault: Pubkey, period_id: u64, bump: u8) {
        self.vault = vault;
        self.period_id = period_id;
        self.twap = 0;
        self.dar = 0;
        self.drip_timestamp = 0;
        self.bump = bump;
    }

    pub fn increase_drip_amount_to_reduce(&mut self, extra_drip: u64) {
        self.dar = self.dar.checked_add(extra_drip).expect("dar overflow");
    }

    pub fn decrease_drip_amount_to_reduce(&mut self, position_drip: u64) {
        self.dar = self.dar.checked_sub(position_drip).expect("dar underflow");
    }

    pub fn update_twap(
        &mut self,
        last_period: &Account<VaultPeriod>,
        sent_a: u64,
        received_b: u64,
    ) {
        let price = compute_price(received_b, sent_a);
        self.twap = calculate_new_twap_amount(last_period.twap, self.period_id, price);
    }

    pub fn update_drip_timestamp(&mut self) {
        let now = Clock::get().unwrap().unix_timestamp;
        self.drip_timestamp = now;
    }
}

test_account_size!(VaultPeriod);
