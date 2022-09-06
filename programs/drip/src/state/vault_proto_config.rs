use crate::test_account_size;
use anchor_lang::prelude::*;

pub const MAX_TOKEN_SPREAD_INCLUSIVE: u16 = 5_000;

#[account]
#[derive(Default)]
pub struct VaultProtoConfig {
    pub granularity: u64, // 8
    // spread applied to each drip trigger in bps
    pub token_a_drip_trigger_spread: u16, // 2
    // spread applied to each withdrawal in bps
    pub token_b_withdrawal_spread: u16, // 2
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
        drip_trigger_spread: u16,
        base_withdrawal_spread: u16,
        admin: Pubkey,
    ) {
        self.granularity = granularity;
        self.token_a_drip_trigger_spread = drip_trigger_spread;
        self.token_b_withdrawal_spread = base_withdrawal_spread;
        self.admin = admin;
    }
}

test_account_size!(VaultProtoConfig);
