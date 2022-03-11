use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Granularity must be an integer larger than 0")]
    InvalidGranularity,
    #[msg("Periodic drip amount == 0")]
    PeriodicDripAmountIsZero,
    #[msg("Cannot get vault bump")]
    CannotGetVaultBump,
    #[msg("Cannot get position bump")]
    CannotGetPositionBump,
    #[msg("Cannot get vault_period bump")]
    CannotGetVaultPeriodBump,
    #[msg("Withdrawable amount is zero")]
    WithdrawableAmountIsZero,
    #[msg("DCA already triggered for the current period. Duplicate DCA triggers not allowed")]
    DuplicateDCAError,
    #[msg("Swap did not complete")]
    IncompleteSwapError,
    #[msg("Invalid swap fee account")]
    InvalidSwapFeeAccount,
    #[msg("Invalid swap authority account")]
    InvalidSwapAuthorityAccount,
}
