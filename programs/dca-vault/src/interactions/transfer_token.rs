use crate::sign;
use crate::state::Vault;
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

pub struct TransferToken<'info> {
    token_program: Program<'info, Token>,
    from: Account<'info, TokenAccount>,
    to: Account<'info, TokenAccount>,
    amount: u64,
}

impl<'info> TransferToken<'info> {
    pub fn new(
        token_program: &Program<'info, anchor_spl::token::Token>,
        from: &Account<'info, anchor_spl::token::TokenAccount>,
        to: &Account<'info, anchor_spl::token::TokenAccount>,
        amount: u64,
    ) -> Self {
        TransferToken {
            token_program: token_program.clone(),
            from: from.clone(),
            to: to.clone(),
            amount,
        }
    }

    pub fn execute(self, vault: &Account<'info, Vault>) -> Result<()> {
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: self.from.to_account_info(),
                    to: self.to.to_account_info(),
                    authority: vault.to_account_info().clone(),
                },
                &[sign!(vault)],
            ),
            self.amount,
        )
    }
}
