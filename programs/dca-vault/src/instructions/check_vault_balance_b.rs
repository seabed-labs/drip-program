use anchor_lang::prelude::*;
use anchor_spl::token::{ TokenAccount, Mint };
use crate::state::Vault;


#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct CheckVaultBalanceB<'info> {
    // User Account
    pub user: Signer<'info>,

    pub vault: Account<'info, Vault>,

    pub token_b_account: Account<'info, TokenAccount>,
    pub token_b_mint: Account<'info, Mint>,

    // TODO (cappucino): Flesh out other accounts needed
}

pub fn handler(ctx: Context<CheckVaultBalanceB>) -> ProgramResult {
    Ok(())
}