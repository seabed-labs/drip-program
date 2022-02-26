pub fn calculate_periodic_drip_amount(total_amount: u64, dca_cycles: u64) -> u64 {
    total_amount / dca_cycles
}

#[cfg(test)]
mod test {
    use super::*;
    use test_case::test_case;

    #[test_case(0, 10, 0; "Works when amount is 0")]
    #[test_case(10, 10, 1; "Works when drip amount is 1")]
    #[test_case(10, 100, 0; "Works when drip amount is 0 due to underflow")]
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
}
