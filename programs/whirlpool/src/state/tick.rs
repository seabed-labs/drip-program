use crate::state::NUM_REWARDS;
use anchor_lang::prelude::*;

// Max & min tick index based on sqrt(1.0001) & max.min price of 2^64
pub const MAX_TICK_INDEX: i32 = 443636;
pub const MIN_TICK_INDEX: i32 = -443636;

// We have two consts because most of our code uses it as a i32. However,
// for us to use it in tick array declarations, anchor requires it to be a usize.
pub const TICK_ARRAY_SIZE: i32 = 88;
pub const TICK_ARRAY_SIZE_USIZE: usize = 88;

#[zero_copy]
#[repr(packed)]
#[derive(Default, Debug, PartialEq)]
pub struct Tick {
    // Total 137 bytes
    pub initialized: bool,     // 1
    pub liquidity_net: i128,   // 16
    pub liquidity_gross: u128, // 16

    // Q64.64
    pub fee_growth_outside_a: u128, // 16
    // Q64.64
    pub fee_growth_outside_b: u128, // 16

    // Array of Q64.64
    pub reward_growths_outside: [u128; NUM_REWARDS], // 48 = 16 * 3
}

#[derive(Default, Debug, PartialEq)]
pub struct TickUpdate {
    pub initialized: bool,
    pub liquidity_net: i128,
    pub liquidity_gross: u128,
    pub fee_growth_outside_a: u128,
    pub fee_growth_outside_b: u128,
    pub reward_growths_outside: [u128; NUM_REWARDS],
}

#[account(zero_copy)]
#[repr(packed)]
pub struct TickArray {
    pub start_tick_index: i32,
    pub ticks: [Tick; TICK_ARRAY_SIZE_USIZE],
    pub whirlpool: Pubkey,
}
