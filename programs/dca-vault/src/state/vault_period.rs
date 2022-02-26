use super::traits::ByteSized;
use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct VaultPeriod {
    // Account relations
    pub vault: Pubkey,

    // Data
    pub period_id: u64, // The period index/offset from the genesis period of the vault (0, 1, ...)
    pub twap: u64, // Time weighted average price of asset A expressed in asset B from period 1 to this period
    pub dar: u64,  // Drip amount to reduce at this period
}

impl VaultPeriod {
    pub fn increase_drip_amount_to_reduce(&mut self, new_deposit: u64) {
        self.dar += new_deposit;
    }
}

impl ByteSized for VaultPeriod {}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn sanity_check_byte_size() {
        assert_eq!(VaultPeriod::byte_size(), 56);
    }
}
