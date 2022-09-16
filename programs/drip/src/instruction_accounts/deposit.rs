use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::interactions::create_token_metadata::MetaplexTokenMetadata;
use crate::state::{Position, Vault, VaultPeriod};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositParams {
    pub token_a_deposit_amount: u64,
    pub number_of_swaps: u64,
}

#[derive(Accounts)]
pub struct DepositCommonAccounts<'info> {
    // mut reason: creating account
    #[account(mut)]
    pub depositor: Signer<'info>,

    // mut reason: modifying state
    #[account(mut)]
    pub vault: Box<Account<'info, Vault>>,

    // mut reason: modifying state
    #[account(mut)]
    pub vault_period_end: Box<Account<'info, VaultPeriod>>,

    // mut reason: changing balance
    #[account(mut)]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    // mut reason: changing balance
    #[account(mut)]
    pub user_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        // Allocate an extra 64 bytes to future proof this
        space = Position::ACCOUNT_SPACE + 64,
        seeds = [
            b"user_position".as_ref(),
            user_position_nft_mint.key().as_ref()
        ],
        bump,
        payer = depositor
    )]
    pub user_position: Box<Account<'info, Position>>,

    #[account(
        init,
        mint::authority = vault,
        mint::decimals = 0,
        payer = depositor
    )]
    pub user_position_nft_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        associated_token::mint = user_position_nft_mint,
        associated_token::authority = depositor,
        payer = depositor
    )]
    pub user_position_nft_account: Box<Account<'info, TokenAccount>>,

    pub referrer: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositAccounts<'info> {
    pub common: DepositCommonAccounts<'info>,
}

#[derive(Accounts)]
pub struct DepositWithMetadataAccounts<'info> {
    pub common: DepositCommonAccounts<'info>,

    /// CHECK: Checked by metaplex's program
    #[account(mut)]
    pub position_metadata_account: UncheckedAccount<'info>,
    pub metadata_program: Program<'info, MetaplexTokenMetadata>,
}
