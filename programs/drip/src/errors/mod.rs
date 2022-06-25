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
    #[msg("Token Swap is Not Whitelisted")]
    InvalidSwapAccount,
    #[msg("A Vault May Limit to a Maximum of 5 Token Swaps")]
    InvalidNumSwaps,
    #[msg("Provided account references the wrong vault-proto-config")]
    InvalidVaultProtoConfigReference,
    #[msg("Invalid swap authority account")]
    InvalidSwapAuthorityAccount,
    #[msg("Invalid swap fee account")]
    InvalidSwapFeeAccount,
    #[msg("Invalid vault-period")]
    InvalidVaultPeriod,
    #[msg("Provided account references the wrong vault")]
    InvalidVaultReference,
    #[msg("Periodic drip amount == 0")]
    PeriodicDripAmountIsZero,
    #[msg("Position is already closed")]
    PositionAlreadyClosed,
    #[msg("Withdrawable amount is zero")]
    WithdrawableAmountIsZero,
}
