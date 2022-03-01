use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Token, TokenAccount};

use crate::state::{Position, Vault};

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    #[account(
        mut,
        seeds = [
            b"dca-vault-v1".as_ref(),
            vault.token_a_mint.as_ref(),
            vault.token_b_mint.as_ref(),
            vault.proto_config.as_ref()
        ],
        bump = vault.bump,
    )]
    pub vault: Box<Account<'info, Vault>>,

    #[account(
        mut,
        seeds = [
            b"user_position".as_ref(),
            user_position.vault.as_ref(),
            user_position.position_authority.as_ref(),
        ],
        bump = user_position.bump,
        constraint = !user_position.is_closed
    )]
    pub user_position: Box<Account<'info, Position>>,

    #[account(
        mut,
        constraint = {
            user_position_nft_account.mint == user_position.position_authority &&
            user_position_nft_account.owner == withdrawer.key() &&
            user_position_nft_account.delegate.contains(&vault.key()) &&
            user_position_nft_account.amount == 1
        }
    )]
    pub user_position_nft_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub withdrawer: Signer<'info>,

    #[account(address = Token::id())]
    pub token_program: Program<'info, Token>,
    #[account(address = anchor_spl::associated_token::ID)]
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClosePosition>) -> Result<()> {
    msg!("Initialized VaultPeriod");
    Ok(())
}
