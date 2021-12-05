use crate::state::{ByteSized, Vault, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeVaultBumps {
    vault: u8,
    token_a_account: u8,
    token_b_account: u8,
}

#[derive(Accounts)]
#[instruction(bumps: InitializeVaultBumps)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        seeds = [
            b"dca-vault-v1".as_ref(),
            token_a_mint.key().as_ref(),
            token_b_mint.key().as_ref(),
            vault_proto_config.key().as_ref(),
        ],
        bump = bumps.vault,
        payer = creator,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        seeds = [
            b"token_a_account".as_ref(),
            vault.key().as_ref(),
            token_a_mint.key().as_ref(),
        ],
        bump = bumps.token_a_account,
        token::mint = token_a_mint,
        token::authority = vault,
        payer = creator
    )]
    pub token_a_account: Account<'info, TokenAccount>,

    #[account(
        init,
        seeds = [
            b"token_b_account".as_ref(),
            vault.key().as_ref(),
            token_b_mint.key().as_ref(),
        ],
        bump = bumps.token_b_account,
        token::mint = token_b_mint,
        token::authority = vault,
        payer = creator,
    )]
    pub token_b_account: Account<'info, TokenAccount>,

    pub token_a_mint: Account<'info, Mint>,
    pub token_b_mint: Account<'info, Mint>,
    pub vault_proto_config: Account<'info, VaultProtoConfig>,
    pub creator: Signer<'info>,

    #[account(address = anchor_spl::token::ID)]
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>, // TODO(matcha): Add remaining accounts here, if any
}

pub fn handler(ctx: Context<InitializeVault>, _bump: InitializeVaultBumps) -> ProgramResult {
    let vault = &mut ctx.accounts.vault;
    vault.proto_config = ctx.accounts.vault_proto_config.key();
    vault.token_a_mint = ctx.accounts.token_a_mint.key();
    vault.token_b_mint = ctx.accounts.token_b_mint.key();
    vault.token_a_account = ctx.accounts.token_a_account.key();
    vault.token_b_account = ctx.accounts.token_b_account.key();
    vault.last_dca_period = 0;
    vault.drip_amount = 0;

    msg!("Initialized Vault");
    Ok(())
}
