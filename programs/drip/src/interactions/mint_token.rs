use std::fmt;

use crate::sign;
use crate::state::traits::{CPI, PDA};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint};
use anchor_spl::token::{Token, TokenAccount};

pub struct MintToken<'info> {
    token_program: Program<'info, Token>,
    mint: Account<'info, Mint>,
    to: Account<'info, TokenAccount>,
    /// CHECK: Suppress anchor error, this isn't an IX context struct
    authority: AccountInfo<'info>,
    amount: u64,
}

impl<'info> MintToken<'info> {
    pub fn new(
        token_program: &Program<'info, Token>,
        mint: &Account<'info, Mint>,
        to: &Account<'info, TokenAccount>,
        authority: &AccountInfo<'info>,
        amount: u64,
    ) -> Self {
        MintToken {
            token_program: token_program.clone(),
            mint: mint.clone(),
            to: to.clone(),
            authority: authority.clone(),
            amount,
        }
    }
}

impl<'info> fmt::Debug for MintToken<'info> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("MintToken")
            .field("token_program", &self.token_program.key)
            .field("mint", &self.mint)
            .field("to", &self.to)
            .field("authority", &self.authority)
            .field("amount", &self.amount)
            .finish()
    }
}

impl<'info> CPI for MintToken<'info> {
    fn execute(&self, signer: &dyn PDA) -> Result<()> {
        token::mint_to(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token::MintTo {
                    mint: self.mint.to_account_info(),
                    to: self.to.to_account_info(),
                    authority: self.authority.clone(),
                },
                &[sign!(signer)],
            ),
            self.amount,
        )
    }

    fn id(&self) -> String {
        format!("{:?}", self)
    }
}
