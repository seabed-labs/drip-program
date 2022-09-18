use std::fmt;

use crate::state::traits::{CPI, PDA};
use crate::{sign, TokenSwap};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::{Mint, Token, TokenAccount};

pub struct SwapSPLTokenSwap<'info> {
    token_swap_program: Program<'info, TokenSwap>,
    token_program: Program<'info, Token>,
    /// CHECK: not needed here
    token_swap: AccountInfo<'info>,
    /// CHECK: not needed here
    swap_authority: AccountInfo<'info>,
    /// CHECK: not needed here
    user_transfer_authority: AccountInfo<'info>,
    user_token_a_account: Box<Account<'info, TokenAccount>>,
    swap_token_a_account: Box<Account<'info, TokenAccount>>,
    swap_token_b_account: Box<Account<'info, TokenAccount>>,
    user_token_b_account: Box<Account<'info, TokenAccount>>,
    swap_mint: Box<Account<'info, Mint>>,
    swap_fee_account: Box<Account<'info, TokenAccount>>,
    amount_in: u64,
    minimum_out: u64,
}

impl<'info> SwapSPLTokenSwap<'info> {
    pub fn new(
        token_swap_program: &Program<'info, TokenSwap>,
        token_program: &Program<'info, Token>,
        token_swap: &AccountInfo<'info>,
        swap_authority: &AccountInfo<'info>,
        user_transfer_authority: &AccountInfo<'info>,
        user_token_a_account: &Box<Account<'info, TokenAccount>>,
        swap_token_a_account: &Box<Account<'info, TokenAccount>>,
        swap_token_b_account: &Box<Account<'info, TokenAccount>>,
        user_token_b_account: &Box<Account<'info, TokenAccount>>,
        swap_mint: &Box<Account<'info, Mint>>,
        swap_fee_account: &Box<Account<'info, TokenAccount>>,
        amount_in: u64,
        minimum_out: u64,
    ) -> Self {
        SwapSPLTokenSwap {
            token_swap_program: token_swap_program.clone(),
            token_program: token_program.clone(),
            token_swap: token_swap.clone(),
            swap_authority: swap_authority.clone(),
            user_transfer_authority: user_transfer_authority.clone(),
            user_token_a_account: user_token_a_account.clone(),
            swap_token_a_account: swap_token_a_account.clone(),
            swap_token_b_account: swap_token_b_account.clone(),
            user_token_b_account: user_token_b_account.clone(),
            swap_mint: swap_mint.clone(),
            swap_fee_account: swap_fee_account.clone(),
            amount_in,
            minimum_out,
        }
    }
}

impl<'info> fmt::Debug for SwapSPLTokenSwap<'info> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SwapSPLTokenSwap")
            .field("token_swap_program", &self.token_swap_program.key)
            .field("token_program", &self.token_program.key)
            .field("token_swap", &self.token_swap)
            .field("swap_authority", &self.swap_authority)
            .field("user_transfer_authority", &self.user_transfer_authority)
            .field("user_token_a_account", &self.user_token_a_account)
            .field("swap_token_a_account", &self.swap_token_a_account)
            .field("swap_token_b_account", &self.swap_token_b_account)
            .field("user_token_b_account", &self.user_token_b_account)
            .field("swap_mint", &self.swap_mint)
            .field("swap_fee_account", &self.swap_fee_account)
            .field("amount_in", &self.amount_in)
            .field("minimum_out", &self.minimum_out)
            .finish()
    }
}

impl<'info> CPI for SwapSPLTokenSwap<'info> {
    fn execute(&self, signer: &dyn PDA) -> Result<()> {
        let ix = spl_token_swap::instruction::swap(
            &self.token_swap_program.key(),
            &self.token_program.key(),
            &self.token_swap.key(),
            &self.swap_authority.key(),
            &self.user_transfer_authority.key(),
            &self.user_token_a_account.key(),
            &self.swap_token_a_account.key(),
            &self.swap_token_b_account.key(),
            &self.user_token_b_account.key(),
            &self.swap_mint.key(),
            &self.swap_fee_account.key(),
            None,
            spl_token_swap::instruction::Swap {
                amount_in: self.amount_in,
                minimum_amount_out: self.minimum_out,
            },
        )?;

        //   The order in which swap accepts the accounts. (Adding it for now to refer/review easily)
        //
        //   0. `[]` Token-swap
        //   1. `[]` swap authority
        //   2. `[]` user transfer authority
        //   3. `[writable]` token_(A|B) SOURCE Account, amount is transferable by user transfer authority,
        //   4. `[writable]` token_(A|B) Base Account to swap INTO.  Must be the SOURCE token.
        //   5. `[writable]` token_(A|B) Base Account to swap FROM.  Must be the DESTINATION token.
        //   6. `[writable]` token_(A|B) DESTINATION Account assigned to USER as the owner.
        //   7. `[writable]` Pool token mint, to generate trading fees
        //   8. `[writable]` Fee account, to receive trading fees
        //   9. '[]` Token program id
        //   10 `[optional, writable]` Host fee account to receive additional trading fees

        invoke_signed(
            &ix,
            &[
                self.token_swap.to_account_info(),
                self.swap_authority.to_account_info(),
                self.user_transfer_authority.to_account_info(),
                self.user_token_a_account.to_account_info(),
                self.swap_token_a_account.to_account_info(),
                self.swap_token_b_account.to_account_info(),
                self.user_token_b_account.to_account_info(),
                self.swap_mint.to_account_info(),
                self.swap_fee_account.to_account_info(),
                self.token_program.to_account_info(),
            ],
            &[sign!(signer)],
        )?;

        Ok(())
    }

    fn id(&self) -> String {
        format!("{:?}", self)
    }
}
