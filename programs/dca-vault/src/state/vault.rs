use anchor_lang::prelude::*;

use super::traits::ByteSized;

// #[zero_copy]
// #[derive(Default)]
// pub struct PeriodicState {
//     pub twap: u64, // Time weighted average price of asset A expressed in asset B from period 1 to this period
//     pub dar: u64, // Drip amount to reduce at this period
// }

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
}

impl ByteSized for Vault {}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn sanity_check_byte_size() {
        assert_eq!(Vault::byte_size(), 176);
    }
}
