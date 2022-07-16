use anchor_lang::prelude::*;

use super::traits::ByteSized;

#[account]
#[derive(Default)]
pub struct VaultProtoConfig {
    pub granularity: u64,            // 8
    pub trigger_dca_spread: u16,     // 2
    pub base_withdrawal_spread: u16, // 2
    // to be used with the vault to modify certain fields (whitelist)
    pub admin: Pubkey, //32
}

impl VaultProtoConfig {
    // total space -> 56
    // allocation needed: ceil( (44+8)/8 )*8 -> 56
    pub const ACCOUNT_SPACE: usize = 56;

    pub fn init(
        &mut self,
        granularity: u64,
        trigger_dca_spread: u16,
        base_withdrawal_spread: u16,
        admin: Pubkey,
    ) {
        self.granularity = granularity;
        self.trigger_dca_spread = trigger_dca_spread;
        self.base_withdrawal_spread = base_withdrawal_spread;
        self.admin = admin;
    }
}

impl ByteSized for VaultProtoConfig {}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn sanity_check_byte_size() {
        assert_eq!(
            VaultProtoConfig::byte_size(),
            VaultProtoConfig::ACCOUNT_SPACE - 8
        );
    }
}
