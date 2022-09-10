use crate::errors::DripError;
use crate::state::{Vault, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use spl_token::state::AccountState;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeVaultParams {
    pub max_slippage_bps: u16,
    pub whitelisted_swaps: Vec<Pubkey>,
}

#[derive(Accounts)]
pub struct InitializeVaultAccounts<'info> {
    // mut needed because we are initializing the account
    #[account(mut, address = vault_proto_config.admin @DripError::OnlyAdminCanInitVault)]
    pub creator: Signer<'info>,

    /* DRIP ACCOUNTS */
    #[account(
        init,
        space = Vault::ACCOUNT_SPACE,
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

    #[account(
        constraint = treasury_token_b_account.mint == token_b_mint.key() @DripError::InvalidMint,
        constraint = treasury_token_b_account.state == AccountState::Initialized
    )]
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
pub struct UpdateVaultWhitelistedSwapsParams {
    pub whitelisted_swaps: Vec<Pubkey>,
}

// TODO(Mocha): this naming is awkward
#[derive(Accounts)]
pub struct UpdateVaultWhitelistedSwapsAccounts<'info> {
    #[account(mut, address = vault_proto_config.admin @DripError::SignerIsNotAdmin)]
    pub admin: Signer<'info>,

    #[account(
        // mut needed because we are changing state
        mut,
        seeds = [
            b"drip-v1".as_ref(),
            vault.token_a_mint.key().as_ref(),
            vault.token_b_mint.key().as_ref(),
            vault_proto_config.key().as_ref(),
        ],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        constraint = vault_proto_config.key() == vault.proto_config @DripError::InvalidVaultProtoConfigReference
    )]
    pub vault_proto_config: Account<'info, VaultProtoConfig>,
}
