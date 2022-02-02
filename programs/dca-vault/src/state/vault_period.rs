use super::traits::ByteSized;
use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct VaultPeriod {
    // Account relations
    pub vault: Pubkey,

    // Data
    pub index: u64, // The period index/offset from the genesis period of the vault (0, 1, ...)
    pub twap: u64, // Time weighted average price of asset A expressed in asset B from period 1 to this period
    pub dar: u64,  // Drip amount to reduce at this period
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
