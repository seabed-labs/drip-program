use crate::state::{VaultProtoConfig, vault::Vault};
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        seeds = [
            b"dca-vault-v1".as_ref(),
            token_a_mint.key().as_ref(),
            token_b_mint.key().as_ref(),
            vault_proto_config.key().as_ref(),
        ],
        bump = bump,
        payer = creator,
        space = 8 + 96
    )]
    pub vault: Account<'info, Vault>,
    pub token_a_mint: Account<'info, Mint>,
    pub token_b_mint: Account<'info, Mint>,
    pub vault_proto_config: Account<'info, VaultProtoConfig>,
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
    // TODO(matcha): Flesh this out (eg: Add token_a_account, token_b_account PDAs and prob more)
}

pub fn handler(ctx: Context<InitializeVault>, _bump: u8) -> ProgramResult {
    let vault = &mut ctx.accounts.vault;
    vault.token_a_mint = ctx.accounts.token_a_mint.key();
    vault.token_b_mint = ctx.accounts.token_b_mint.key();
    vault.proto_config = ctx.accounts.vault_proto_config.key();

    msg!("Initialized Vault");
    Ok(())
}
