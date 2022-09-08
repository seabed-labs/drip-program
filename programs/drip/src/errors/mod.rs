use anchor_lang::prelude::*;

#[error_code]
pub enum DripError {
    #[msg("Cannot get position bump")]
    CannotGetPositionBump,
    #[msg("Cannot get vault bump")]
    CannotGetVaultBump,
    #[msg("Cannot get vault_period bump")]
    CannotGetVaultPeriodBump,
    #[msg("Drip already triggered for the current period")]
    DuplicateDripError,
    #[msg("Swap did not complete, either received token_b is 0")]
    IncompleteSwapError,
    #[msg("Granularity must be an integer larger than 0")]
    InvalidGranularity,
    #[msg("Token mint does not match expected value")]
    InvalidMint,
    #[msg("Spread must be >=0 and <5000")]
    InvalidSpread,
    #[msg("Token Swap is Not Whitelisted")]
    InvalidSwapAccount,
    #[msg("A Vault May Whitelist a Maximum of 5 Swap Accounts")]
    InvalidNumSwaps,
    #[msg("Provided account references the wrong vault-proto-config")]
    InvalidVaultProtoConfigReference,
    #[msg("Invalid vault-period")]
    InvalidVaultPeriod,
    #[msg("Provided account references the wrong vault")]
    InvalidVaultReference,
    #[msg("Only admin can init vault")]
    OnlyAdminCanInitVault,
    #[msg("Periodic drip amount == 0")]
    PeriodicDripAmountIsZero,
    #[msg("Position is already closed")]
    PositionAlreadyClosed,
    #[msg("Withdrawable amount is zero")]
    WithdrawableAmountIsZero,
    #[msg("Cannot initialize a vault period lesser than vault's current period")]
    CannotInitializeVaultPeriodLessThanVaultCurrentPeriod,
    #[msg("Invalid value for vault.max_slippage_bps")]
    InvalidVaultMaxSlippage,
    #[msg("Swapped more than vault's drip amount")]
    SwappedMoreThanVaultDripAmount,
    #[msg("Number of swaps is zero")]
    NumSwapsIsZero,
    #[msg("Signer is not admin")]
    SignerIsNotAdmin,
    #[msg("Incorrect vault token account passed in")]
    IncorrectVaultTokenAccount,
    #[msg("Account is owned by the wrong account")]
    InvalidOwner,
    #[msg("Position token account balance is empty")]
    PositionBalanceIsZero,
    #[msg("Referrer does not match position referrer")]
    InvalidReferrer,
}
