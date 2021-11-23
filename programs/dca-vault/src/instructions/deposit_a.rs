use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount};
use crate::state::Vault;
use anchor_spl::token::Mint;
use anchor_spl::token::Token;

#[derive(Accounts)]
#[instruction(deposit_amount: u64, total_duration_millis: u64)]
pub struct DepositA<'info> {
    // User Account
    pub depositor: Signer<'info>,

    // // The vault where the token will be deposited
    #[account(mut)]
    pub vault: Account<'info, Vault>,

    // // Need to add some macros for validation
    // // No need to add init or pay for it since these accounts are already created
    #[account(mut)]
    pub depositor_token_a_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub depositor_token_b_account: Account<'info, TokenAccount>,

    pub token_a_mint: Account<'info, Mint>,
    pub token_b_mint: Account<'info, Mint>,

    #[account(address = anchor_spl::token::ID)]
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<DepositA>, deposit_amount: u64, total_duration_millis: u64) -> ProgramResult {
    msg!("Deposited A");
    Ok(())
}