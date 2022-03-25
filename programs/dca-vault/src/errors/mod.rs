use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Cannot get position bump")]
    CannotGetPositionBump,
    #[msg("Cannot get vault bump")]
    CannotGetVaultBump,
    #[msg("Cannot get vault_period bump")]
    CannotGetVaultPeriodBump,
    #[msg("DCA already triggered for the current period")]
    DuplicateDCAError,
    #[msg("Swap did not complete")]
    IncompleteSwapError,
    #[msg("Granularity must be an integer larger than 0")]
    InvalidGranularity,
    #[msg("Token mint does not match expected value")]
    InvalidMint,
    #[msg("Spread must be >=0 and <=10000")]
    InvalidSpread,
    #[msg("Invalid swap authority account")]
    InvalidSwapAuthorityAccount,
    #[msg("Invalid swap fee account")]
    InvalidSwapFeeAccount,
    #[msg("Periodic drip amount == 0")]
    PeriodicDripAmountIsZero,
    #[msg("Withdrawable amount is zero")]
    WithdrawableAmountIsZero,
}
