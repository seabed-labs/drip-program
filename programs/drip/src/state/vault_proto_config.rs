use anchor_lang::prelude::*;

use super::traits::ByteSized;

#[account]
#[derive(Default)]
pub struct VaultProtoConfig {
    // total space -> 12
    // allocation needed: ceil( (12+8)/8 )*8 -> 24
    pub granularity: u64,            // 8
    pub trigger_dca_spread: u16,     // 2
    pub base_withdrawal_spread: u16, // 2
}

impl VaultProtoConfig {
    pub fn init(&mut self, granularity: u64, trigger_dca_spread: u16, base_withdrawal_spread: u16) {
        self.granularity = granularity;
        self.trigger_dca_spread = trigger_dca_spread;
        self.base_withdrawal_spread = base_withdrawal_spread;
    }
}

impl ByteSized for VaultProtoConfig {}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn sanity_check_byte_size() {
        assert_eq!(VaultProtoConfig::byte_size(), 24 - 8);
    }
}
