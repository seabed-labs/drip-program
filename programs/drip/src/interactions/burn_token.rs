use std::fmt;

use crate::sign;
use crate::state::traits::{CPI, PDA};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint};
use anchor_spl::token::{Burn, Token, TokenAccount};

pub struct BurnToken<'info> {
    token_program: Program<'info, Token>,
    mint: Account<'info, Mint>,
    from: Account<'info, TokenAccount>,
    /// CHECK: Suppress anchor error, this isn't an IX context struct
    authority: AccountInfo<'info>,
    amount: u64,
}

impl<'info> BurnToken<'info> {
    pub fn new(
        token_program: &Program<'info, Token>,
        mint: &Account<'info, Mint>,
        from: &Account<'info, TokenAccount>,
        authority: &AccountInfo<'info>,
        amount: u64,
    ) -> Self {
        BurnToken {
            token_program: token_program.clone(),
            mint: mint.clone(),
            from: from.clone(),
            authority: authority.clone(),
            amount,
        }
    }
}

impl<'info> fmt::Debug for BurnToken<'info> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("BurnToken")
            .field("token_program", &self.token_program.key)
            .field("mint", &self.mint)
            .field("from", &self.from)
            .field("authority", &self.authority)
            .field("amount", &self.amount)
            .finish()
    }
}

impl<'info> CPI for BurnToken<'info> {
    fn execute(self, signer: &impl PDA) -> Result<()> {
        token::burn(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                Burn {
                    mint: self.mint.to_account_info(),
                    from: self.from.to_account_info(),
                    authority: self.authority,
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
