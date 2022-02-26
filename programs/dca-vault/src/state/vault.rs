use anchor_lang::prelude::*;

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
    pub seed_bump: u8,
}

impl Vault {
    pub fn increaase_drip_amount(&mut self, extra_drip: u64) {
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
