use crate::errors::DripError;
use crate::errors::DripError::{InvalidOracleSource, OracleIsOffline};
use crate::{test_account_size, validate};
use anchor_lang::prelude::*;
use fixed::types::I80F48;
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

/// Given two prices quoted against an arbitrary asset Q,
/// return the best possible price of A quoted against B (B/A)
///
/// # Arguments
///
/// * `token_a_price_info`: token a price account data, quoted against Q
/// * `token_b_price_info`: token b price account data, quoted against Q
///
/// returns: I80F48
pub fn get_best_oracle_b_over_a_ui_price(
    source: u8,
    token_a_price_info: &AccountInfo,
    token_b_price_info: &AccountInfo,
) -> Result<I80F48> {
    match source {
        PYTH_SOURCE_ID => {
            // A_price = (oracle_price_a +- oracle_conf_a) * 10^a_expo
            // value_a = oracle_price_a +- oracle_conf_a
            // A_price = value_a * 10^a_expo = Q/A
            //
            // B_price = (oracle_price_b +- oracle_conf_b) * 10^b_expo
            // value_b = oracle_price_b +- oracle_conf_b
            // B_price = value_b * 10^b_expo = Q/B
            //
            // B/A = A_price / B_price
            // = value_a * 10^a_expo / (value_b * 10^b_expo)
            // = value_a * 10^(a_expo-b_expo) / value_b
            // to maximize B/A, we must maximize value_a, and minimize value_b

            // parse pyth account
            let price_feed = load_price_feed_from_account_info(token_a_price_info)
                .unwrap()
                .get_current_price()
                .unwrap();

            // calculate value_a, add confidence to maximize A
            let value_a = price_feed
                .price
                .checked_add(price_feed.conf as i64)
                .unwrap();
            let a_expo = price_feed.expo;

            // parse pyth account
            let price_feed = load_price_feed_from_account_info(token_b_price_info)
                .unwrap()
                .get_current_price()
                .unwrap();

            // calculate value_b, subtract confidence to minimize B
            let value_b = price_feed
                .price
                .checked_sub(price_feed.conf as i64)
                .unwrap();
            let b_expo = price_feed.expo;

            // checked_pow takes in unsigned int, but a_expo - b_expo can be negative
            // switch to checked_div when a_expo - b_expo is negative
            let a_expo_sub_b_expo_scaled = 10u64
                .checked_pow(a_expo.checked_sub(b_expo).unwrap().unsigned_abs())
                .unwrap();
            let numerator = if a_expo.checked_sub(b_expo).unwrap() >= 0 {
                I80F48::from_num(value_a)
                    .checked_mul(I80F48::from_num(a_expo_sub_b_expo_scaled))
                    .unwrap()
            } else {
                I80F48::from_num(value_a)
                    .checked_div(I80F48::from_num(a_expo_sub_b_expo_scaled))
                    .unwrap()
            };
            Ok(numerator.checked_div(I80F48::from_num(value_b)).unwrap())
        }
        _ => Err(DripError::InvalidOracleSource.into()),
    }
}

pub fn validate_oracle(
    source: u8,
    token_a_price_info: &AccountInfo,
    token_b_price_info: &AccountInfo,
) -> Result<()> {
    match source {
        PYTH_SOURCE_ID => {
            // note: we don't have an owner check here, however its not needed as
            // using the oracle config is something an admin does intentionally
            // they are responsible for supplying the correct account
            let price_feed = load_price_feed_from_account_info(token_a_price_info).unwrap();
            validate!(price_feed.status == PriceStatus::Trading, OracleIsOffline);
            let price_feed = load_price_feed_from_account_info(token_b_price_info).unwrap();
            validate!(price_feed.status == PriceStatus::Trading, OracleIsOffline);
        }
        _ => {
            return Err(InvalidOracleSource.into());
        }
    }
    Ok(())
}

test_account_size!(OracleConfig);
