pub fn calculate_periodic_drip_amount(total_amount: u64, dca_cycles: u64) -> u64 {
    total_amount / dca_cycles
}

pub fn calculate_withdraw_all_token_a_amount(
    dca_period_id_before_deposit: u64,
    last_dca_period: u64,
    number_of_swaps: u64,
    periodic_drip_amount: u64,
) -> u64 {
    let completed_swaps = last_dca_period - dca_period_id_before_deposit;
    let remaining_swaps = number_of_swaps - completed_swaps;
    remaining_swaps * periodic_drip_amount
}

/// When a user tries to withdraw on period j assuming they started on period i,
/// we can compute the withdrawable B amount of the user as follows
/// (assuming X and Y are stored in the user's position NFT):
// X (deposit amount)
// Y (total periods to DCA over)
// i (period at which user deposited and ran had their first DCA drip)
// j (latest DCA period, also the period after which the user is trying to withdraw)
//
// usersAveragePriceOverPeriodIToJ = (TWAP[j] * j - TWAP[i] * i) / (j - i)
// drippedASoFar = (X / Y) * (j - i)
// withdrawableAmountB = usersAveragePriceOverPeriodIToJ * drippedASoFar

pub fn calculate_withdraw_token_b_amount(
    dca_period_id_before_deposit: u64,
    last_dca_period: u64,
    twap_i: i64,
    twap_j: i64,
    periodic_drip_amount: u64,
) -> i64 {
    let i = dca_period_id_before_deposit + 1;
    let j = last_dca_period;

    let average_price_over_period_i_to_j =
        (twap_j * (j as i64) - twap_i * (i as i64)) / ((j - i) as i64);

    let dripped_so_far = periodic_drip_amount * (j - i);
    average_price_over_period_i_to_j * (dripped_so_far as i64)
}

#[cfg(test)]
mod test {
    use test_case::test_case;

    use super::*;

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
    fn calculate_withdraw_all_token_a_amount_tests(
        dca_period_id_before_deposit: u64,
        current_period: u64,
        number_of_swaps: u64,
        periodic_drip_amount: u64,
        expected_withdrawal_a: u64,
    ) {
        assert_eq!(
            calculate_withdraw_all_token_a_amount(
                dca_period_id_before_deposit,
                current_period,
                number_of_swaps,
                periodic_drip_amount,
            ),
            expected_withdrawal_a
        );
    }

    #[test_case(10, 2, 8, 5; "Can't withdraw when current_period > dca_period_id_before_deposit")]
    #[should_panic]
    fn calculate_withdraw_all_token_a_amount_panic_tests(
        dca_period_id_before_deposit: u64,
        last_dca_period: u64,
        number_of_swaps: u64,
        periodic_drip_amount: u64,
    ) {
        calculate_withdraw_all_token_a_amount(
            dca_period_id_before_deposit,
            last_dca_period,
            number_of_swaps,
            periodic_drip_amount,
        );
    }

    // TODO(Mocha)
    #[test_case(0, 0, 0, 0, 0, 0; "Can withdraw B in the middle of the DCA")]
    fn calculate_withdraw_token_b_amount_tests(
        dca_period_id_before_deposit: u64,
        last_dca_period: u64,
        twap_i: i64,
        twap_j: i64,
        periodic_drip_amount: u64,
        expected_withdrawal_b: i64,
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

    #[test_case(2, 10, 8, 5, 0; "Can't withdraw B at the end of the DCA")]
    #[should_panic]
    fn calculate_withdraw_token_b_amount_panic_tests(
        dca_period_id_before_deposit: u64,
        last_dca_period: u64,
        twap_i: i64,
        twap_j: i64,
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
