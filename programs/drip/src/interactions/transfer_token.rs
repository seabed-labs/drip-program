use crate::sign;
use crate::state::traits::{CPI, PDA};
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

pub struct TransferToken<'info> {
    token_program: Program<'info, Token>,
    from: Account<'info, TokenAccount>,
    to: Account<'info, TokenAccount>,
    authority: AccountInfo<'info>,
    amount: u64,
}

impl<'info> TransferToken<'info> {
    pub fn new(
        token_program: &Program<'info, Token>,
        from: &Account<'info, anchor_spl::token::TokenAccount>,
        to: &Account<'info, anchor_spl::token::TokenAccount>,
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

impl<'info> CPI for TransferToken<'info> {
    fn execute(self, signer: &impl PDA) -> Result<()> {
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: self.from.to_account_info(),
                    to: self.to.to_account_info(),
                    authority: self.authority.to_account_info().clone(),
                },
                &[sign!(signer)],
            ),
            self.amount,
        )
    }
}
