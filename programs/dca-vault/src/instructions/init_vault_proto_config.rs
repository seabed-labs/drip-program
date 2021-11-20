use crate::state::vault_proto_config::VaultProtoConfig;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct InitializeVaultProtoConfig<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + 8
    )]
    pub vault_proto_config: Account<'info, VaultProtoConfig>,
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeVaultProtoConfig>, granularity: u64) -> ProgramResult {
    let config = &mut ctx.accounts.vault_proto_config;
    config.granularity = granularity;

    msg!("Initialized Vault Proto Config");
    Ok(())
}
