use std::fmt;

use crate::sign;
use crate::state::traits::{CPI, PDA};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::Mint;
use anchor_spl::token::Token;
use spl_token::instruction::AuthorityType;

pub struct SetMintAuthority<'info> {
    token_program: Program<'info, Token>,
    mint: Account<'info, Mint>,
    /// CHECK: Suppress anchor error, this isn't an IX context struct
    current_authority: AccountInfo<'info>,
    new_authority: Option<AccountInfo<'info>>,
}

impl<'info> SetMintAuthority<'info> {
    pub fn new(
        token_program: &Program<'info, Token>,
        mint: &Account<'info, Mint>,
        current_authority: &AccountInfo<'info>,
        new_authority: Option<&AccountInfo<'info>>,
    ) -> Self {
        SetMintAuthority {
            token_program: token_program.clone(),
            mint: mint.clone(),
            current_authority: current_authority.clone(),
            new_authority: new_authority.cloned(),
        }
    }
}

impl<'info> fmt::Debug for SetMintAuthority<'info> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SetMintAuthority")
            .field("token_program", &self.token_program.key)
            .field("mint", &self.mint)
            .field("current_authority", &self.current_authority)
            .field("new_authority", &self.new_authority)
            .finish()
    }
}

impl<'info> CPI for SetMintAuthority<'info> {
    fn execute(self, signer: &impl PDA) -> Result<()> {
        invoke_signed(
            &spl_token::instruction::set_authority(
                self.token_program.key,
                &self.mint.key(),
                self.new_authority.map(|acc| acc.key),
                AuthorityType::MintTokens,
                self.current_authority.key,
                &[self.current_authority.key],
            )?,
            &[self.mint.to_account_info(), self.current_authority],
            &[sign!(signer)],
        )?;

        Ok(())
    }

    fn id(&self) -> String {
        format!("{:?}", self)
    }
}
