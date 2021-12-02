use anchor_lang::prelude::*;

use super::traits::ByteSized;

#[account]
#[derive(Default)]
pub struct Position {
    // Depositor i.e the user who starts a new position (for now)
    // This will later be an NFT that the user will hold 
    pub position_authority: Pubkey, 

    // The A/B/G vault the position belongs to
    pub vault: Pubkey,

    pub deposit_amount_token_a: u32,

    // Will be updated after every swap
    pub dripped_amount_token_b: u32,

    // The date when position was initiated by the user
    pub deposit_date_millis: u128,

    // The date till user wants to DCA
    pub expiry_date_millis: u128,

    // (expiry_date_millis - deposit_date_millis) / granularity
    pub number_of_swaps: u32, 
    pub amount_per_period: u32,

    // Will need to update these accounts after every swap
    pub user_token_a_account: Pubkey,
}

impl ByteSized for Position {}

#[cfg(test)]
mod test {
    use super::*;
    #[test]
    fn sanity_check_byte_size() {
        assert_eq!(Position::byte_size(), 144); 
    }
}