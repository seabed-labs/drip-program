
// This file will be used to specify Dcaf-protocol specific Errors

use anchor_lang::prelude::*;

#[error]
pub enum ErrorCode {
    #[msg("DCA already trigerred for the current period. Duplicate DCA triggers not allowed")]
    DuplicateDCAError
}
