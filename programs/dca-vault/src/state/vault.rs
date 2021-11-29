use anchor_lang::prelude::*;

use super::traits::ByteSized;

// This is a skeleton, not the final thing

#[account]
#[derive(Default)]
pub struct Vault {
    pub vault_proto_config: Pubkey,
    pub token_a_mint: Pubkey, // A
    pub token_b_mint: Pubkey, // B
    pub token_a_account: Pubkey,
    pub token_b_account: Pubkey,

    // This is the amount of token A that needs to be dripped into token B every period of size G
    pub drip_amount: u32, 

    // The last period for which the DCA has run successfully
    latest_dca_period_id: u64,

    // TODO (matcha), TWAP[] and dripAmountToReduce[]
}

impl ByteSized for Vault {}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn sanity_check_byte_size() {
        assert_eq!(Vault::byte_size(), 160);
    }
}