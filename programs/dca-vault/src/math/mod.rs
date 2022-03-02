pub fn calculate_periodic_drip_amount(total_amount: u64, dca_cycles: u64) -> u64 {
    total_amount / dca_cycles
}

///
/// # Arguments
///
/// * `dca_period_id_before_deposit`: the last completed period before deposit
/// (at the time of deposit, this should be the same as last_dca_period)
/// * `last_dca_period`: the last completed period of the vault
/// * `number_of_swaps`: total number of swaps the user will participate in
/// * `periodic_drip_amount`: amount of asset a used in each period to buy asset b
///
/// returns: u64
pub fn calculate_withdraw_token_a_amount(
    dca_period_id_before_deposit: u64,
    last_dca_period: u64,
    number_of_swaps: u64,
    periodic_drip_amount: u64,
) -> u64 {
    let completed_swaps = last_dca_period - dca_period_id_before_deposit;
    if number_of_swaps <= completed_swaps {
        return 0;
    }
    let remaining_swaps = number_of_swaps - completed_swaps;
    remaining_swaps * periodic_drip_amount
}

///
/// # Arguments
///
/// * `dca_period_id_before_deposit`: the last completed period before deposit
/// (at the time of deposit, this should be the same as last_dca_period, also known as i)
/// * `last_dca_period`: the last completed period of the vault (also known as j)
/// * `number_of_swaps`: total number of swaps the user will participate in
/// * `twap_i`: the value of twap in the vault period account for period i (dca_period_id_before_deposit)
/// * `twap_j`: the value of twap in the vault period account for period j (last_dca_period)
/// * `periodic_drip_amount`: amount of asset a used in each period to buy asset b
///
/// returns: u64
pub fn calculate_withdraw_token_b_amount(
    dca_period_id_before_deposit: u64,
    last_dca_period: u64,
    twap_i: u64,
    twap_j: u64,
    periodic_drip_amount: u64,
) -> u64 {
    let i = dca_period_id_before_deposit;
    let j = last_dca_period;
    if i == j {
        return 0;
    }
    let average_price_from_start = (twap_j * j - twap_i * i) / (j - i);
    let dripped_so_far = periodic_drip_amount * (j - i);
    let result = average_price_from_start * dripped_so_far;
    result
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
    #[test_case(0, 4, 0, 25, 4, 25*4*4; "Can withdraw B when starting from first period")]
    #[test_case(1, 4, 10, 25, 4, 30*4*3; "Can withdraw B when not starting from first period")]
    #[test_case(4, 4, 10, 25, 4, 0; "Can withdraw 0 B when i equals j")]
    fn calculate_withdraw_token_b_amount_tests(
        dca_period_id_before_deposit: u64,
        last_dca_period: u64,
        twap_i: u64,
        twap_j: u64,
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
    #[test_case(1, 4, 0, 25, u64::max_value(); "Should panic if overflow")]
    #[should_panic]
    fn calculate_withdraw_token_b_amount_panic_tests(
        dca_period_id_before_deposit: u64,
        last_dca_period: u64,
        twap_i: u64,
        twap_j: u64,
        periodic_drip_amount: u64,
    ) {
        calculate_withdraw_token_b_amount(
            dca_period_id_before_deposit,
            last_dca_period,
            twap_i,
            twap_j,
            periodic_drip_amount,
        );
    }
}
