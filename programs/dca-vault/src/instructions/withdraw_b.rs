
use anchor_lang::prelude::*;
use anchor_spl::token::{ TokenAccount, Mint };
use crate::state::Vault;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct WithdrawB<'info> {
    // User Account
    pub withdrawer: Signer<'info>,

    // The vault where the token B will be withdrawn from
    #[account(mut)]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub depositor_token_b_account: Account<'info, TokenAccount>,
    pub token_b_mint: Account<'info, Mint>,

    // TODO (cappucino): Flesh out other accounts needed
}

pub fn handler(ctx: Context<WithdrawB>, amount: u64) -> ProgramResult {
    msg!("Withdrawed B");
    Ok(())
}