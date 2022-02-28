use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("DCA already trigerred for the current period. Duplicate DCA triggers not allowed")]
    DuplicateDCAError,
    #[msg("Granularity must be an integer larger than 0")]
    InvalidGranularity,
    #[msg("Periodic drip amount == 0")]
    PeriodicDripAmountIsZero,
    #[msg("Cannot get vault bump")]
    CannotGetVaultBump,
    #[msg("Cannot get vault_period bump")]
    CannotGetVaultPeriodBump,
}
