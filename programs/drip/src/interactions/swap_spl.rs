use crate::instructions::drip_spl_token_swap::TokenSwap;
use crate::sign;
use crate::state::traits::{CPI, PDA};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::Mint;
use anchor_spl::token::{Token, TokenAccount};

pub struct SwapSPL<'info> {
    token_program: Program<'info, Token>,
    token_swap_program: Program<'info, TokenSwap>,
    source_token_account: Account<'info, TokenAccount>,
    destination_token_account: Account<'info, TokenAccount>,
    swap_source_token_account: Account<'info, TokenAccount>,
    swap_destination_token_account: Account<'info, TokenAccount>,
    /// CHECK: Not needed
    swap_authority_account_info: AccountInfo<'info>,
    /// CHECK: Not needed
    user_transfer_authority: AccountInfo<'info>,
    /// CHECK: Not needed
    swap_account_info: AccountInfo<'info>,
    swap_token_mint: Account<'info, Mint>,
    swap_fee_account: Account<'info, TokenAccount>,
    amount: u64,
    min_amount_out: u64,
}

impl<'info> SwapSPL<'info> {
    pub fn new(
        token_program: Program<'info, Token>,
        token_swap_program: Program<'info, TokenSwap>,
        source_token_account: Account<'info, TokenAccount>,
        destination_token_account: Account<'info, TokenAccount>,
        swap_source_token_account: Account<'info, TokenAccount>,
        swap_destination_token_account: Account<'info, TokenAccount>,
        swap_authority_account_info: AccountInfo<'info>,
        user_transfer_authority: AccountInfo<'info>,
        swap_account_info: AccountInfo<'info>,
        swap_token_mint: Account<'info, Mint>,
        swap_fee_account: Account<'info, TokenAccount>,
        amount: u64,
        min_amount_out: u64,
    ) -> Self {
        SwapSPL {
            token_program,
            token_swap_program,
            source_token_account,
            destination_token_account,
            swap_source_token_account,
            swap_destination_token_account,
            swap_authority_account_info,
            user_transfer_authority,
            swap_account_info,
            swap_token_mint,
            swap_fee_account,
            amount,
            min_amount_out,
        }
    }
}

impl<'info> CPI for SwapSPL<'info> {
    fn execute(self, signer: &impl PDA) -> Result<()> {
        let ix = spl_token_swap::instruction::swap(
            &self.token_swap_program.key(),
            &self.token_program.key(),
            &self.swap_account_info.key(),
            &self.swap_authority_account_info.key(),
            &self.swap_authority_account_info.key(),
            &self.source_token_account.key(),
            &self.swap_source_token_account.key(),
            &self.swap_destination_token_account.key(),
            &self.destination_token_account.key(),
            &self.swap_token_mint.key(),
            &self.swap_fee_account.key(),
            None,
            spl_token_swap::instruction::Swap {
                amount_in: self.amount,
                minimum_amount_out: self.min_amount_out,
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
                self.swap_account_info.to_account_info(),
                self.swap_authority_account_info.to_account_info(),
                self.user_transfer_authority.to_account_info(),
                self.source_token_account.to_account_info(),
                self.swap_source_token_account.to_account_info(),
                self.swap_destination_token_account.to_account_info(),
                self.destination_token_account.to_account_info(),
                self.swap_token_mint.to_account_info(),
                self.swap_fee_account.to_account_info(),
                self.token_program.to_account_info(),
            ],
            &[sign!(signer)],
        )?;

        Ok(())
    }
}
