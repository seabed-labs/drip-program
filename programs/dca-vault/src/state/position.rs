use anchor_lang::prelude::*;

use super::traits::ByteSized;

#[account]
#[derive(Default)]
pub struct Position {
    // Depositor i.e the user who starts a new position (for now)
    // This will later be an NFT that the user will hold 
    pub position_authority: Pubkey, 

    // holds the granularity the user choose i.e. weekly/daily
    pub proto_config: Pubkey, 

    // The A/B/G vault the position belongs to
    pub vault: Pubkey,

    pub deposit_amount_token_a: u32,
    pub balance_token_a: u32,
    pub dripped_amount_token_b: u32,

    // The date when position was initiated by the user
    pub deposit_date: u64,

    // The date till user wants to DCA
    pub expiry_date: u64, 

    // (expiry_date - deposit_date) / granularity
    pub number_of_swaps: u32, 

    // deposit_amount_token_a / number_of_swaps
    pub swap_amount_per_period: u32, 

    // Will need to update these accounts after every DCA period
    pub user_token_a_account: Pubkey,
    pub user_token_b_account: Pubkey,

    // Not sure if these are needed? Since they are stored in vault as well
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
}

impl ByteSized for Position {}

#[cfg(test)]
mod test {
    use super::*;
    #[test]
    fn sanity_check_byte_size() {
        assert_eq!(Position::byte_size(), 264); 
    }
}