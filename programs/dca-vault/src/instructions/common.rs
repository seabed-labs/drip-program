use anchor_lang::prelude::*;

#[error]
pub enum ErrorCode {
    #[msg("Granularity must be an integer larger than 0")]
    InvalidGranularity,
}
