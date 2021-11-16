use anchor_lang::prelude::*;

// This is a skeleton, not the final thing

#[account]
#[derive(Default)]
pub struct Vault {
    pub token_a_mint: Pubkey, // A
    pub token_b_mint: Pubkey, // B
    pub granularity: u64,     // G in milliseconds
                              // TODO(matcha): Flesh this out more
}
