use anchor_lang::prelude::*;

use super::traits::ByteSized;

// This is a skeleton, not the final thing

#[account]
#[derive(Default)]
pub struct Vault {
    pub proto_config: Pubkey,
    pub token_a_mint: Pubkey, // A
    pub token_b_mint: Pubkey, // B
    pub token_a_account: Pubkey,
    pub token_b_account: Pubkey,
                              // TODO(matcha): Flesh this out more
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