use anchor_lang::prelude::*;

use super::traits::ByteSized;

#[account]
#[derive(Default)]
pub struct VaultProtoConfig {
    pub granularity: i64,
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
