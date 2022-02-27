use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Granularity must be an integer larger than 0")]
    InvalidGranularity,
    #[msg("Periodic drip amount == 0")]
    PeriodicDripAmountIsZero,
    #[msg("Cannot get vault bump")]
    CannotGetVaultBump,
}
