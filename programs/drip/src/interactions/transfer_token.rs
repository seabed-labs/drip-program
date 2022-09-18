use std::fmt;

use crate::sign;
use crate::state::traits::{CPI, PDA};
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use super::executor::CpiIdentifier;

pub struct TransferToken<'info> {
    token_program: Program<'info, Token>,
    from: Account<'info, TokenAccount>,
    to: Account<'info, TokenAccount>,
    /// CHECK: Suppress anchor error, this isn't an IX context struct
    authority: AccountInfo<'info>,
    amount: u64,
}

impl<'info> TransferToken<'info> {
    pub fn new(
        token_program: &Program<'info, Token>,
        from: &Account<'info, TokenAccount>,
        to: &Account<'info, TokenAccount>,
        authority: &AccountInfo<'info>,
        amount: u64,
    ) -> Self {
        TransferToken {
            token_program: token_program.clone(),
            from: from.clone(),
            to: to.clone(),
            authority: authority.clone(),
            amount,
        }
    }
}

impl<'info> fmt::Debug for TransferToken<'info> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("TransferToken")
            .field("token_program", &self.token_program.key)
            .field("from", &self.from)
            .field("to", &self.to)
            .field("authority", &self.authority)
            .field("amount", &self.amount)
            .finish()
    }
}

impl<'info> CPI for TransferToken<'info> {
    fn execute(&self, signer: &dyn PDA) -> Result<()> {
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: self.from.to_account_info(),
                    to: self.to.to_account_info(),
                    authority: self.authority.clone(),
                },
                &[sign!(signer)],
            ),
            self.amount,
        )
    }

    fn id(&self) -> CpiIdentifier {
        CpiIdentifier::TransferToken {
            token_program: self.token_program.key(),
            from: self.from.key(),
            to: self.to.key(),
            authority: self.authority.key(),
            amount: self.amount,
        }
    }
}
