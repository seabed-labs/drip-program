#[macro_export]
macro_rules! sign {
    ( $x:ident ) => {
        &[&$x.seeds()[..], &[[$x.bump].as_ref()][..]].concat()
    };
}
