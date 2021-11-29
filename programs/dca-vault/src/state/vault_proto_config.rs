use anchor_lang::prelude::*;

use super::traits::ByteSized;

#[account]
#[derive(Default)]
pub struct VaultProtoConfig {
    pub granularity: u128,
    // TODO(matcha): Add more stuff here if needed
}

impl ByteSized for VaultProtoConfig {} 

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn sanity_check_byte_size() {
        assert_eq!(VaultProtoConfig::byte_size(), 8);
    }
}