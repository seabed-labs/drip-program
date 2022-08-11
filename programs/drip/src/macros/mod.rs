#[macro_export]
macro_rules! sign {
    ( $x:ident ) => {
        &[&$x.seeds()[..], &[[$x.bump].as_ref()][..]].concat()
    };
}

#[macro_export]
macro_rules! test_account_size {
    ( $x:ident ) => {
        #[cfg(test)]
        mod test {
            use super::*;
            use crate::constants::ANCHOR_DISCRIMINATOR_SIZE;
            use crate::state::traits::ByteSized;

            impl ByteSized for $x {}

            #[test]
            fn sanity_check_byte_size() {
                assert_eq!(
                    $x::byte_size() + ANCHOR_DISCRIMINATOR_SIZE,
                    $x::ACCOUNT_SPACE
                );
            }
        }
    };
}
