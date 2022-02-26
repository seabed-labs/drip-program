use crate::state::{Vault, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        seeds = [
            b"dca-vault-v1".as_ref(),
            token_a_mint.key().as_ref(),
            token_b_mint.key().as_ref(),
            vault_proto_config.key().as_ref(),
        ],
        bump,
        payer = creator,
    )]
    pub vault: Box<Account<'info, Vault>>,

    #[account(
        init,
        associated_token::mint = token_a_mint,
        associated_token::authority = vault,
        payer = creator
    )]
    pub token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        associated_token::mint = token_b_mint,
        associated_token::authority = vault,
        payer = creator,
    )]
    pub token_b_account: Box<Account<'info, TokenAccount>>,

    pub token_a_mint: Box<Account<'info, Mint>>,

    pub token_b_mint: Box<Account<'info, Mint>>,

    pub vault_proto_config: Box<Account<'info, VaultProtoConfig>>,

    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(address = anchor_spl::token::ID)]
    pub token_program: Program<'info, Token>,
    #[account(address = anchor_spl::associated_token::ID)]
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>, // TODO(matcha): Add remaining accounts here, if any
}

pub fn handler(ctx: Context<InitializeVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.proto_config = ctx.accounts.vault_proto_config.key();
    vault.token_a_mint = ctx.accounts.token_a_mint.key();
    vault.token_b_mint = ctx.accounts.token_b_mint.key();
    vault.token_a_account = ctx.accounts.token_a_account.key();
    vault.token_b_account = ctx.accounts.token_b_account.key();
    vault.last_dca_period = 0;
    vault.drip_amount = 0;
    vault.bump = *ctx.bumps.get("vault").unwrap();

    let now = Clock::get().unwrap().unix_timestamp;
    // TODO(matcha): Abstract away this date flooring math and add unit tests
    // TODO(matcha): Figure out how to test this on integration tests without replicating the logic
    vault.dca_activation_timestamp = now - now % ctx.accounts.vault_proto_config.granularity;

    msg!("Initialized Vault");
    Ok(())
}
