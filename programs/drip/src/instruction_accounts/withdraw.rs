use crate::errors::DripError;
use crate::state::{Position, Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::prelude::*;

use anchor_spl::token::Mint;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
pub struct WithdrawCommonAccounts<'info> {
    // mut needed for close_position since we refund lamports
    #[account(mut)]
    pub withdrawer: Signer<'info>,

    /* DRIP ACCOUNTS */
    // mut needed for close_position
    #[account(mut)]
    pub vault: Box<Account<'info, Vault>>,

    pub vault_proto_config: Box<Account<'info, VaultProtoConfig>>,

    pub vault_period_i: Account<'info, VaultPeriod>,

    pub vault_period_j: Account<'info, VaultPeriod>,

    #[account(
        // mut needed because we are updating withdrawn amount
        mut,
        seeds = [
            b"user_position".as_ref(),
            user_position.position_authority.as_ref()
        ],
        bump = user_position.bump,
        constraint = user_position.vault == vault.key() @DripError::InvalidVaultReference,
        constraint = !user_position.is_closed @DripError::PositionAlreadyClosed,
    )]
    pub user_position: Account<'info, Position>,

    /* TOKEN ACCOUNTS */
    // mut needed for close_position
    #[account(mut)]
    pub user_position_nft_account: Account<'info, TokenAccount>,

    // mut needed because we are changing the balance
    #[account(mut)]
    pub vault_token_b_account: Box<Account<'info, TokenAccount>>,

    // mut needed because we are changing balance
    #[account(mut)]
    pub vault_treasury_token_b_account: Box<Account<'info, TokenAccount>>,

    // mut needed because we are changing the balance
    #[account(mut)]
    pub user_token_b_account: Box<Account<'info, TokenAccount>>,

    // mut needed because we are changing the balance
    #[account(mut)]
    pub referrer: Box<Account<'info, TokenAccount>>,

    /* MISC */
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawBAccounts<'info> {
    pub common: WithdrawCommonAccounts<'info>,
}

#[derive(Accounts)]
pub struct ClosePositionAccounts<'info> {
    pub common: WithdrawCommonAccounts<'info>,

    // mut needed because we are changing state
    #[account(mut)]
    pub vault_period_user_expiry: Box<Account<'info, VaultPeriod>>,

    // mut needed because we are changing balance
    #[account(mut)]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    // mut needed because we are changing balance
    #[account(mut)]
    pub user_token_a_account: Box<Account<'info, TokenAccount>>,

    // mut needed because we are burning the users NFT
    #[account(mut)]
    pub user_position_nft_mint: Box<Account<'info, Mint>>,
}
