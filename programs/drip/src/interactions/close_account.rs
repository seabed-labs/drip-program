use std::fmt;

use crate::state::traits::{CPI, PDA};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::{Token, TokenAccount};
use spl_token::instruction::close_account;

use super::executor::CpiIdentifier;

pub struct CloseAccount<'info> {
    token_program: Program<'info, Token>,
    token_account: Account<'info, TokenAccount>,
    /// CHECK: Suppress anchor error, this isn't an IX context struct
    destination: AccountInfo<'info>,
    /// CHECK: Suppress anchor error, this isn't an IX context struct
    authority: AccountInfo<'info>,
}

impl<'info> CloseAccount<'info> {
    pub fn new(
        token_program: &Program<'info, Token>,
        token_account: &Account<'info, TokenAccount>,
        destination: &AccountInfo<'info>,
        authority: &AccountInfo<'info>,
    ) -> Self {
        CloseAccount {
            token_program: token_program.clone(),
            token_account: token_account.clone(),
            destination: destination.clone(),
            authority: authority.clone(),
        }
    }
}

impl<'info> fmt::Debug for CloseAccount<'info> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("CloseAccount")
            .field("token_program", &self.token_program.key)
            .field("token_account", &self.token_account)
            .field("destination", &self.destination)
            .field("authority", &self.authority)
            .finish()
    }
}

impl<'info> CPI for CloseAccount<'info> {
    fn execute(&self, _: &dyn PDA) -> Result<()> {
        invoke_signed(
            &close_account(
                self.token_program.key,
                &self.token_account.key(),
                self.destination.key,
                self.authority.key,
                &[],
            )?,
            &[
                self.token_program.to_account_info(),
                self.token_account.to_account_info(),
                self.destination.to_account_info(),
                self.authority.to_account_info(),
            ],
            &[],
        )?;
        Ok(())
    }

    fn id(&self) -> CpiIdentifier {
        CpiIdentifier::CloseAccount {
            token_program: self.token_program.key(),
            token_account: self.token_account.key(),
            destination: self.destination.key(),
            authority: self.authority.key(),
        }
    }
}
