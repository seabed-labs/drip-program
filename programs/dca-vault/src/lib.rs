use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("6rCWVjanBs1gx5jhpUAXoDqLwwURaNxKoGUxczjG6hFX");

#[program]
pub mod dca_vault {
    use super::*;

    pub fn init_vault_proto_config(ctx: Context<InitializeVaultProtoConfig>, granularity: u64) -> ProgramResult {
        instructions::init_vault_proto_config::handler(ctx, granularity)
    }

    pub fn init_vault(ctx: Context<InitializeVault>, bump: u8) -> ProgramResult {
        instructions::init_vault::handler(ctx, bump)
    }
}

#[derive(Accounts)]
pub struct Initialize {}

// This is just an example unit test, once we have proper unit tests in other files, this can be removed.
#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}
