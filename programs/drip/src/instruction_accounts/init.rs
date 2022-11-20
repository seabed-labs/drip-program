use crate::state::{OracleConfig, Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeVaultProtoConfigParams {
    pub granularity: u64,
    pub token_a_drip_trigger_spread: u16,
    pub token_b_withdrawal_spread: u16,
    pub token_b_referral_spread: u16,
    pub admin: Pubkey,
}

#[derive(Accounts)]
pub struct InitializeVaultProtoConfigAccounts<'info> {
    // mut needed because we are debiting SOL from the signer to create the vault_proto_config account
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        // Allocate an extra 128 bytes to future proof this
        space = VaultProtoConfig::ACCOUNT_SPACE + 128,
        payer = creator
    )]
    pub vault_proto_config: Account<'info, VaultProtoConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeVaultPeriodParams {
    pub period_id: u64,
}

#[derive(Accounts)]
#[instruction(params: InitializeVaultPeriodParams)]
pub struct InitializeVaultPeriodAccounts<'info> {
    #[account(
        init,
        space = VaultPeriod::ACCOUNT_SPACE,
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            params.period_id.to_string().as_bytes()
        ],
        bump,
        payer = creator,
    )]
    pub vault_period: Account<'info, VaultPeriod>,

    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeOracleConfigParams {
    pub enabled: bool,
    pub source: u8,
    pub update_authority: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: InitializeOracleConfigParams)]
pub struct InitializeOracleConfigAccounts<'info> {
    #[account(
        init,
        // Allocate an extra 128 bytes to future proof this
        space = OracleConfig::ACCOUNT_SPACE + 128,
        payer = creator,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    pub token_a_mint: Account<'info, Mint>,
    /// CHECK: Need to custom decode based on "source"
    pub token_a_price: UncheckedAccount<'info>,

    pub token_b_mint: Account<'info, Mint>,
    /// CHECK: Need to custom decode based on "source"
    pub token_b_price: UncheckedAccount<'info>,

    // mut needed because we are debiting SOL from the signer to create the oracle_config account
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}
