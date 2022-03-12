use std::convert::{TryFrom, TryInto};
use std::ops::Div;

pub fn calculate_periodic_drip_amount(total_amount: u64, dca_cycles: u64) -> u64 {
    total_amount.checked_div(dca_cycles).unwrap()
}

///
/// # Arguments
///
/// * `i`: the last completed period before deposit (dca_period_id_before_deposit)
/// (at the time of deposit, this should be the same as last_dca_period)
/// * `j`: the min of vault.last_dca_period, and user position expiry (dca_period_id_before_deposit + number_of_swaps)
/// * `number_of_swaps`: total number of swaps the user will participate in
/// * `periodic_drip_amount`: amount of asset a used in each period to buy asset b
///
/// returns: u64
pub fn calculate_withdraw_token_a_amount(
    i: u64,
    j: u64,
    number_of_swaps: u64,
    periodic_drip_amount: u64,
) -> u64 {
    let completed_swaps = j.checked_sub(i).unwrap();
    if number_of_swaps <= completed_swaps {
        return 0;
    }
    let remaining_swaps = number_of_swaps.checked_sub(completed_swaps).unwrap();
    remaining_swaps.checked_mul(periodic_drip_amount).unwrap()
}

///
/// # Arguments
///
/// * `i`: the last completed period before deposit (dca_period_id_before_deposit)
/// (at the time of deposit, this should be the same as last_dca_period, also known as i)
/// * `j`: the min of vault.last_dca_period, and user position expiry (dca_period_id_before_deposit + number_of_swaps)
/// * `number_of_swaps`: total number of swaps the user will participate in
/// * `twap_i`: the value of twap in the vault period account for period i (dca_period_id_before_deposit)
/// * `twap_j`: the value of twap in the vault period account for period j (last_dca_period)
/// * `periodic_drip_amount`: amount of asset a used in each period to buy asset b
///
/// returns: u64
pub fn calculate_withdraw_token_b_amount(
    i: u64,
    j: u64,
    twap_i_x64: u128,
    twap_j_x64: u128,
    periodic_drip_amount: u64,
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

#[cfg(test)]
mod test {
    use super::*;
    use test_case::test_case;

    #[test_case(0, 10, 0; "Works when amount is 0")]
    #[test_case(10, 10, 1; "Works when drip amount is 1")]
    #[test_case(10, 100, 0; "Works when drip amount is 0 due to underflow")]
    #[test_case(3, 2, 1; "Rounding case 1")]
    #[test_case(19, 10, 1; "Rounding case 2")]
    #[test_case(160, 20, 8; "Normal case")]
    fn calculate_periodic_drip_tests(
        total_amount: u64,
        dca_cycles: u64,
        expected_periodic_drip_amount: u64,
    ) {
        assert_eq!(
            calculate_periodic_drip_amount(total_amount, dca_cycles),
            expected_periodic_drip_amount
        );
    }

    #[test_case(0, 0; "Both inputs are 0")]
    #[test_case(10, 0; "DCA cycles is 0")]
    #[should_panic]
    fn calculate_periodic_drip_panic_tests(total_amount: u64, dca_cycles: u64) {
        calculate_periodic_drip_amount(total_amount, dca_cycles);
    }

    #[test_case(2, 6, 8, 5, 20; "Can withdraw A in the middle of the DCA")]
    #[test_case(2, 10, 8, 5, 0; "Can't withdraw A at the end of the DCA")]
    #[test_case(2, 11, 8, 5, 0; "Can't withdraw A past the end of the DCA")]
    fn calculate_withdraw_token_a_amount_tests(
        dca_period_id_before_deposit: u64,
        current_period: u64,
        number_of_swaps: u64,
        periodic_drip_amount: u64,
        expected_withdrawal_a: u64,
    ) {
        assert_eq!(
            calculate_withdraw_token_a_amount(
                dca_period_id_before_deposit,
                current_period,
                number_of_swaps,
                periodic_drip_amount,
            ),
            expected_withdrawal_a
        );
    }

    #[test_case(10, 2, 8, 5; "Can't withdraw when current_period < dca_period_id_before_deposit")]
    #[should_panic]
    fn calculate_withdraw_token_a_amount_panic_tests(
        dca_period_id_before_deposit: u64,
        last_dca_period: u64,
        number_of_swaps: u64,
        periodic_drip_amount: u64,
    ) {
        calculate_withdraw_token_a_amount(
            dca_period_id_before_deposit,
            last_dca_period,
            number_of_swaps,
            periodic_drip_amount,
        );
    }

    // Price token_b/token_a: 10, 20, 30, 40, 50, 60, 70
    // TWAP: [0, 10, 15, 20, 25, 30, 35, 40]
    // In practice there will be a lot more 0's as we are dealing with base values
    #[test_case(0, 4,  0 << 64, 25 << 64, 4, 25*4*4; "Can withdraw B when starting from first period")]
    #[test_case(1, 4, 10 << 64, 25 << 64, 4, 30*4*3; "Can withdraw B when not starting from first period")]
    #[test_case(4, 4, 10 << 64, 25 << 64, 4, 0; "Can withdraw 0 B when i equals j")]
    fn calculate_withdraw_token_b_amount_tests(
        dca_period_id_before_deposit: u64,
        last_dca_period: u64,
        twap_i: u128,
        twap_j: u128,
        periodic_drip_amount: u64,
        expected_withdrawal_b: u64,
    ) {
        assert_eq!(
            calculate_withdraw_token_b_amount(
                dca_period_id_before_deposit,
                last_dca_period,
                twap_i,
                twap_j,
                periodic_drip_amount,
            ),
            expected_withdrawal_b,
        );
    }

    #[test_case(4, 1, 0, 25, 4; "Should panic when j is less than i")]
    #[test_case(1, 4, 0, u128::max_value(), 4; "Should panic if overflow")]
    #[should_panic]
    fn calculate_withdraw_token_b_amount_panic_tests(
        i: u64,
        j: u64,
        twap_i: u128,
        twap_j: u128,
        periodic_drip_amount: u64,
    ) {
        calculate_withdraw_token_b_amount(i, j, twap_i, twap_j, periodic_drip_amount);
    }
}
