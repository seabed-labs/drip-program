use anchor_lang::prelude::*;
use anchor_spl::token::{ TokenAccount, Mint };
use crate::state::Vault;


#[derive(Accounts)]
pub struct ClosePosition<'info> {
    pub client: Signer<'info>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub depositor_token_a_account: Account<'info, TokenAccount>,
    pub token_a_mint: Account<'info, Mint>,

    #[account(mut)]
    pub depositor_token_b_account: Account<'info, TokenAccount>,
    pub token_b_mint: Account<'info, Mint>,
}

pub fn handler(ctx: Context<ClosePosition>) -> ProgramResult {
    msg!("Position closed");
    Ok(())
}