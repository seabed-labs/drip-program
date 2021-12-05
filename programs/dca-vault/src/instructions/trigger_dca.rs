use crate::state::Vault;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

#[derive(Accounts)]
pub struct TriggerDCA<'info> {
    pub client: Signer<'info>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,
}

pub fn handler(ctx: Context<TriggerDCA>) -> ProgramResult {
    msg!("DCA triggered");
    Ok(())
}
