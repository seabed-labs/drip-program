use crate::state::{OracleConfig, Vault, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeVaultParams {
    pub max_slippage_bps: u16,
    pub whitelisted_swaps: Vec<Pubkey>,
}

#[derive(Accounts)]
pub struct InitializeVaultAccounts<'info> {
    // mut needed because we are initializing the account
    #[account(mut)]
    pub creator: Signer<'info>,

    /* DRIP ACCOUNTS */
    #[account(
        init,
        // Allocate an extra 96 bytes to future proof this
        space = Vault::ACCOUNT_SPACE + 96,
        seeds = [
            b"drip-v1".as_ref(),
            token_a_mint.key().as_ref(),
            token_b_mint.key().as_ref(),
            vault_proto_config.key().as_ref(),
        ],
        bump,
        payer = creator,
    )]
    pub vault: Box<Account<'info, Vault>>,

    pub vault_proto_config: Box<Account<'info, VaultProtoConfig>>,

    /* TOKEN ACCOUNTS */
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

    pub treasury_token_b_account: Box<Account<'info, TokenAccount>>,

    /* MINTS */
    pub token_a_mint: Box<Account<'info, Mint>>,

    pub token_b_mint: Box<Account<'info, Mint>>,

    /* MISC */
    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SetVaultWhitelistedSwapsParams {
    pub whitelisted_swaps: Vec<Pubkey>,
}

#[derive(Accounts)]
pub struct SetVaultFieldCommonAccounts<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    // mut needed because we are changing state
    #[account(mut)]
    pub vault: Account<'info, Vault>,

    pub vault_proto_config: Account<'info, VaultProtoConfig>,
}

#[derive(Accounts)]
pub struct SetVaultWhitelistedSwapsAccounts<'info> {
    pub vault_update_common_accounts: SetVaultFieldCommonAccounts<'info>,
}

#[derive(Accounts)]
pub struct SetVaultOracleConfigAccounts<'info> {
    pub vault_update_common_accounts: SetVaultFieldCommonAccounts<'info>,

    pub new_oracle_config: Account<'info, OracleConfig>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateOracleConfigParams {
    pub enabled: bool,
    pub source: u8,
    pub new_update_authority: Pubkey,
}

#[derive(Accounts)]
pub struct UpdateOracleConfigAccounts<'info> {
    // mut needed because we are changing state
    #[account(mut)]
    pub oracle_config: Account<'info, OracleConfig>,

    pub new_token_a_mint: Account<'info, Mint>,
    /// CHECK: Need to custom decode based on "source"
    pub new_token_a_price: UncheckedAccount<'info>,

    pub new_token_b_mint: Account<'info, Mint>,
    /// CHECK: Need to custom decode based on "source"
    pub new_token_b_price: UncheckedAccount<'info>,

    pub current_update_authority: Signer<'info>,
}
