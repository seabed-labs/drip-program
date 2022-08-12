use std::{convert::TryFrom, u128};

fn calculate_slippage_factor(max_slippage_bps: u16, a_to_b: bool) -> f64 {
    if a_to_b {
        // Example
        // Price decreases
        // We want -10% of the current price
        // new_price = old_price * 0.9
        // new_sqrt_price = old_sqrt_price * sqrt(0.9)
        // new_sqrt_price = (old_sqrt_price * 9486) / 1e4
        let factor = 1.0 - 0.0001 * f64::from(max_slippage_bps);
        let factor = f64::sqrt(factor);
        factor
    } else {
        // Example
        // Price increases
        // We want +10% of the current price
        // new_price = old_price * 1.1
        // new_sqrt_price = old_sqrt_price * sqrt(1.1)
        // new_sqrt_price = (old_sqrt_price * 10488) / 1e4
        let factor = 1.0 + 0.0001 * f64::from(max_slippage_bps);
        let factor = f64::sqrt(factor);
        factor
    }
}

pub fn calculate_sqrt_price_limit(
    current_sqrt_price: u128,
    max_slippage_bps: u16,
    a_to_b: bool,
) -> u128 {
    let precision = 10000;
    let factor = calculate_slippage_factor(max_slippage_bps, a_to_b);
    let factor = (factor * (precision as f64)).floor() as u128;
    current_sqrt_price
        .checked_mul(factor)
        .expect("new sqrt price calc failed 1")
        .checked_div(precision as u128)
        .expect("new sqrt price calc failed 2")
}

pub fn calculate_periodic_drip_amount(total_amount: u64, number_of_swaps: u64) -> u64 {
    total_amount.checked_div(number_of_swaps).unwrap()
}

///
/// # Arguments
///
/// * `i`: the last completed period before deposit (drip_period_id_before_deposit)
/// (at the time of deposit, this should be the same as last_drip_period)
/// * `j`: the min of vault.last_drip_period, and user position expiry (drip_period_id_before_deposit + number_of_swaps)
/// * `user_position_number_of_swaps`: total number of swaps the user will participate in
/// * `periodic_drip_amount`: amount of asset a used in each period to buy asset b
///
/// returns: u64
pub fn calculate_withdraw_token_a_amount(
    i: u64,
    j: u64,
    user_position_number_of_swaps: u64,
    periodic_drip_amount: u64,
) -> u64 {
    let swaps_completed_since_user_deposit = j.checked_sub(i).unwrap();
    if user_position_number_of_swaps <= swaps_completed_since_user_deposit {
        return 0;
    }
    let remaining_swaps = user_position_number_of_swaps
        .checked_sub(swaps_completed_since_user_deposit)
        .unwrap();
    remaining_swaps.checked_mul(periodic_drip_amount).unwrap()
}

///
/// # Arguments
///
/// * `i`: the last completed period before deposit (drip_period_id_before_deposit)
/// (at the time of deposit, this should be the same as last_drip_period, also known as i)
/// * `j`: the min of vault.last_drip_period, and user position expiry (drip_period_id_before_deposit + number_of_swaps)
/// * `number_of_swaps`: total number of swaps the user will participate in
/// * `twap_i`: the value of twap in the vault period account for period i (drip_period_id_before_deposit)
/// * `twap_j`: the value of twap in the vault period account for period j (last_drip_period)
/// * `periodic_drip_amount`: amount of asset a used in each period to buy asset b
/// * `token_a_drip_trigger_spread`: spread applied in each drip trigger
///
/// returns: u64
pub fn calculate_withdraw_token_b_amount(
    i: u64,
    j: u64,
    twap_i_x64: u128,
    twap_j_x64: u128,
    periodic_drip_amount: u64,
    token_a_drip_trigger_spread: u16,
) -> u64 {
    if i == j {
        return 0;
    }

    let i = u128::from(i);
    let j = u128::from(j);
    let periodic_drip_amount = u128::from(periodic_drip_amount);

    // (twap_j * j - twap_i * i) / (j - i)
    let average_price_from_start_x64 = (twap_j_x64
        .checked_mul(j)
        .unwrap()
        .checked_sub(twap_i_x64.checked_mul(i).unwrap())
        .unwrap())
    .checked_div(j.checked_sub(i).unwrap())
    .unwrap();
    // periodic_drip_amount * (j-i)
    let dripped_so_far = periodic_drip_amount
        .checked_mul(j.checked_sub(i).unwrap())
        .unwrap();
    // subtract spreads we've already taken
    let drip_trigger_spread_amount = calculate_spread_amount(
        u64::try_from(dripped_so_far).unwrap(),
        token_a_drip_trigger_spread,
    );
    let dripped_so_far = dripped_so_far
        .checked_sub(drip_trigger_spread_amount.into())
        .unwrap();
    // average_price_from_start * dripped_so_far
    let amount_x64 = average_price_from_start_x64
        .checked_mul(dripped_so_far)
        .unwrap();

    u64::try_from(amount_x64.checked_shr(64).unwrap()).unwrap()
}

// TODO: Add unit tests
pub fn calculate_new_twap_amount(twap_i_minus_1: u128, i: u64, price_i: u128) -> u128 {
    // (twap[i-1] * (i - 1) + p[i]) / i
    twap_i_minus_1
        .checked_mul(u128::from(i.checked_sub(1).unwrap()))
        .unwrap()
        .checked_add(price_i)
        .unwrap()
        .checked_div(u128::from(i))
        .unwrap()
}

// TODO: Add unit tests
pub fn compute_price(token_b_amount: u64, token_a_amount: u64) -> u128 {
    let numerator_x64 = u128::from(token_b_amount).checked_shl(64).unwrap();
    let denominator = u128::from(token_a_amount);

    numerator_x64.checked_div(denominator).unwrap()
}

///
/// # Arguments
///
/// * `amount`
/// * `spread`
///
/// returns: u64
pub fn calculate_spread_amount(amount: u64, spread: u16) -> u64 {
    u64::try_from(
        u128::from(amount)
            .checked_mul(spread.into())
            .unwrap()
            .checked_div(10000)
            .unwrap(),
    )
    .unwrap()
}

#[cfg(test)]
mod test {
    use super::*;
    use test_case::test_case;

    #[test_case(1000, true, 0.9486832980505138; "a_to_b = true")]
    #[test_case(1000, false, 1.0488088481701516; "a_to_b = false")]
    fn calculate_slippage_factor_tests(
        max_slippage_bps: u16,
        a_to_b: bool,
        expected_slippage_factor: f64,
    ) {
        assert_eq!(
            calculate_slippage_factor(max_slippage_bps, a_to_b),
            expected_slippage_factor
        );
    }

    #[test_case(1000, 1000, true, 948; "a_to_b = true")]
    #[test_case(1000, 1000, false, 1048; "a_to_b = false")]
    fn calculate_sqrt_price_limit_tests(
        current_sqrt_price_limit: u128,
        max_slippage_bps: u16,
        a_to_b: bool,
        expected_sqrt_limit_price: u128,
    ) {
        assert_eq!(
            calculate_sqrt_price_limit(current_sqrt_price_limit, max_slippage_bps, a_to_b),
            expected_sqrt_limit_price
        );
    }

    #[test_case(0, 10, 0; "Works when amount is 0")]
    #[test_case(10, 10, 1; "Works when drip amount is 1")]
    #[test_case(10, 100, 0; "Works when drip amount is 0 due to underflow")]
    #[test_case(3, 2, 1; "Rounding case 1")]
    #[test_case(19, 10, 1; "Rounding case 2")]
    #[test_case(160, 20, 8; "Normal case")]
    fn calculate_periodic_drip_tests(
        total_amount: u64,
        number_of_swaps: u64,
        expected_periodic_drip_amount: u64,
    ) {
        assert_eq!(
            calculate_periodic_drip_amount(total_amount, number_of_swaps),
            expected_periodic_drip_amount
        );
    }

    #[test_case(0, 0; "Both inputs are 0")]
    #[test_case(10, 0; "Number of swaps is 0")]
    #[should_panic]
    fn calculate_periodic_drip_panic_tests(total_amount: u64, number_of_swaps: u64) {
        calculate_periodic_drip_amount(total_amount, number_of_swaps);
    }

    #[test_case(2, 6, 8, 5, 20; "Can withdraw A in the middle of a position")]
    #[test_case(2, 10, 8, 5, 0; "Can't withdraw A at the end of a position")]
    #[test_case(2, 11, 8, 5, 0; "Can't withdraw A past the end of a position")]
    fn calculate_withdraw_token_a_amount_tests(
        drip_period_id_before_deposit: u64,
        current_period: u64,
        number_of_swaps: u64,
        periodic_drip_amount: u64,
        expected_withdrawal_a: u64,
    ) {
        assert_eq!(
            calculate_withdraw_token_a_amount(
                drip_period_id_before_deposit,
                current_period,
                number_of_swaps,
                periodic_drip_amount,
            ),
            expected_withdrawal_a
        );
    }

    #[test_case(10, 2, 8, 5; "Can't withdraw when current_period < drip_period_id_before_deposit")]
    #[should_panic]
    fn calculate_withdraw_token_a_amount_panic_tests(
        drip_period_id_before_deposit: u64,
        last_drip_period: u64,
        number_of_swaps: u64,
        periodic_drip_amount: u64,
    ) {
        calculate_withdraw_token_a_amount(
            drip_period_id_before_deposit,
            last_drip_period,
            number_of_swaps,
            periodic_drip_amount,
        );
    }

    // Price token_b/token_a: 10, 20, 30, 40, 50, 60, 70
    // TWAP: [0, 10, 15, 20, 25, 30, 35, 40]
    // In practice there will be a lot more 0's as we are dealing with base values
    #[test_case(0, 4,  0 << 64, 25 << 64, 4, 0, 25*4*4; "Can withdraw B when starting from first period")]
    #[test_case(0, 4,  0 << 64, 25 << 64, 4, 5000, 25*(4*4 - 8); "Can withdraw B when starting from first period with spread")]
    #[test_case(1, 4, 10 << 64, 25 << 64, 4, 0, 30*4*3; "Can withdraw B when not starting from first period")]
    #[test_case(1, 4, 10 << 64, 25 << 64, 4, 5000, 30*(4*3-6); "Can withdraw B when not starting from first period with spread")]
    #[test_case(4, 4, 10 << 64, 25 << 64, 4, 0, 0; "Can withdraw 0 B when i equals j")]
    #[test_case(1, 4, 10 << 64, 25 << 64, 4, 10000, 0; "Can withdraw 0 B when spread is 10000")]
    fn calculate_withdraw_token_b_amount_tests(
        drip_period_id_before_deposit: u64,
        last_drip_period: u64,
        twap_i: u128,
        twap_j: u128,
        periodic_drip_amount: u64,
        token_a_drip_trigger_spread: u16,
        expected_withdrawal_b: u64,
    ) {
        assert_eq!(
            calculate_withdraw_token_b_amount(
                drip_period_id_before_deposit,
                last_drip_period,
                twap_i,
                twap_j,
                periodic_drip_amount,
                token_a_drip_trigger_spread
            ),
            expected_withdrawal_b,
        );
    }

    #[test_case(4, 1, 0, 25, 4, 0; "Should panic when j is less than i")]
    #[test_case(1, 4, 0, u128::max_value(), 4, 0; "Should panic if overflow")]
    #[should_panic]
    fn calculate_withdraw_token_b_amount_panic_tests(
        i: u64,
        j: u64,
        twap_i: u128,
        twap_j: u128,
        periodic_drip_amount: u64,
        token_a_drip_trigger_spread: u16,
    ) {
        calculate_withdraw_token_b_amount(
            i,
            j,
            twap_i,
            twap_j,
            periodic_drip_amount,
            token_a_drip_trigger_spread,
        );
    }

    #[test_case(0, 5, 0; "Spread amount is 0 with 0 initial amount")]
    #[test_case(10000, 0, 0; "Spread amount is 0 with 0 spread")]
    #[test_case(9999, 10000, 9999; "Spread amount is 0 when initial amount is less then 10000")]
    #[test_case(10000, 10000, 10000; "Spread amount is initial amount with max spread")]
    #[test_case(10000, 9, 9; "Spread amount is expected value")]
    fn calculate_spread_amount_tests(amount: u64, spread: u16, expected_result: u64) {
        assert_eq!(calculate_spread_amount(amount, spread), expected_result,);
    }

    #[test_case(u64::max_value(), u16::max_value(); "Should panic if overflow")]
    #[should_panic]
    fn calculate_spread_amount_panic_tests(amount: u64, spread: u16) {
        calculate_spread_amount(amount, spread);
    }
}
