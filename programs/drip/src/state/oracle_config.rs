use crate::test_account_size;
use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct OracleConfig {
    pub enabled: bool, // 1
    // 0 -> Pyth
    pub source: u8,               // 1
    pub update_authority: Pubkey, //32
    pub token_a_mint: Pubkey,     // 32
    pub token_a_price: Pubkey,    // 32
    pub token_b_mint: Pubkey,     // 32
    pub token_b_price: Pubkey,    // 32
}

impl OracleConfig {
    pub const ACCOUNT_SPACE: usize = 170;

    pub fn init(
        &mut self,
        enabled: bool,
        source: u8,
        update_authority: Pubkey,
        token_a_mint: Pubkey,
        token_a_price: Pubkey,
        token_b_mint: Pubkey,
        token_b_price: Pubkey,
    ) {
        self.enabled = enabled;
        self.source = source;
        self.update_authority = update_authority;
        self.token_a_mint = token_a_mint;
        self.token_a_price = token_a_price;
        self.token_b_mint = token_b_mint;
        self.token_b_price = token_b_price;
    }
}

test_account_size!(OracleConfig);
