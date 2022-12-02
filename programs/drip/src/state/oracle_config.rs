use crate::errors::DripError;
use crate::test_account_size;
use anchor_lang::prelude::*;
use pyth_sdk_solana::{load_price_feed_from_account_info, PriceStatus};

pub const PYTH_SOURCE_ID: u8 = 0;

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

    pub fn set(
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

pub fn get_oracle_price(
    source: u8,
    token_a_price_info: &AccountInfo,
    token_b_price_info: &AccountInfo,
) -> Result<i64> {
    match source {
        PYTH_SOURCE_ID => {
            let price_feed = load_price_feed_from_account_info(token_a_price_info).unwrap();
            if price_feed.status != PriceStatus::Trading {
                return Err(DripError::OracleIsOffline.into());
            }
            let token_a_price_max = price_feed.get_current_price().unwrap();
            let token_a_price_max = token_a_price_max
                .price
                .checked_add(token_a_price_max.conf as i64)
                .unwrap();
            let price_feed = load_price_feed_from_account_info(token_b_price_info).unwrap();
            if price_feed.status != PriceStatus::Trading {
                return Err(DripError::OracleIsOffline.into());
            }
            let token_b_price_min = price_feed.get_current_price().unwrap();
            let token_b_price_min = token_b_price_min
                .price
                .checked_sub(token_b_price_min.conf as i64)
                .unwrap();
            Ok(token_a_price_max.checked_div(token_b_price_min).unwrap())
        }
        _ => Err(DripError::InvalidOracleSource.into()),
    }
}

test_account_size!(OracleConfig);
