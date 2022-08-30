use crate::errors::ErrorCode;
use crate::state::{Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use spl_token::state::AccountState;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeVaultProtoConfigParams {
    granularity: u64,
    token_a_drip_trigger_spread: u16,
    token_b_withdrawal_spread: u16,
    admin: Pubkey,
}

#[derive(Accounts)]
pub struct InitializeVaultProtoConfigAccounts<'info> {
    // mut needed because we are initializing the account
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        space = VaultProtoConfig::ACCOUNT_SPACE,
        payer = creator
    )]
    pub vault_proto_config: Account<'info, VaultProtoConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeVaultParams {
    max_slippage_bps: u16,
    whitelisted_swaps: Vec<Pubkey>,
}

#[derive(Accounts)]
pub struct InitializeVaultAccounts<'info> {
    // mut needed because we are initializing the account
    #[account(mut, address = vault_proto_config.admin @ErrorCode::OnlyAdminCanInitVault)]
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
        constraint = treasury_token_b_account.mint == token_b_mint.key() @ErrorCode::InvalidMint,
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
pub struct InitializeVaultPeriodParams {
    period_id: u64,
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
        constraint = (params.period_id > vault.last_drip_period || (params.period_id == 0 && vault.last_drip_period == 0)) @ErrorCode::CannotInitializeVaultPeriodLessThanVaultCurrentPeriod
    )]
    vault_period: Account<'info, VaultPeriod>,

    #[account(
        seeds = [
            b"drip-v1".as_ref(),
            token_a_mint.key().as_ref(),
            token_b_mint.key().as_ref(),
            vault_proto_config.key().as_ref(),
        ],
        bump = vault.bump
    )]
    vault: Account<'info, Vault>,

    #[account(
        constraint = token_a_mint.key() == vault.token_a_mint @ErrorCode::InvalidMint
    )]
    pub token_a_mint: Account<'info, Mint>,

    #[account(
        constraint = token_b_mint.key() == vault.token_b_mint @ErrorCode::InvalidMint
    )]
    pub token_b_mint: Account<'info, Mint>,

    #[account(
        constraint = vault_proto_config.key() == vault.proto_config
    )]
    pub vault_proto_config: Account<'info, VaultProtoConfig>,

    // mut needed because we are initing accounts
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}
