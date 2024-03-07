use crate::state::{Position, Vault, VaultProtoConfig};
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
        // Allocate an extra 128 bytes to future proof this
        space = Vault::ACCOUNT_SPACE + 128,
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
pub struct UpdateVaultWhitelistedSwapsParams {
    pub whitelisted_swaps: Vec<Pubkey>,
}

// TODO(Mocha): this naming is awkward
#[derive(Accounts)]
pub struct UpdateVaultWhitelistedSwapsAccounts<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    // mut needed because we are changing state
    #[account(mut)]
    pub vault: Account<'info, Vault>,

    pub vault_proto_config: Account<'info, VaultProtoConfig>,
}

#[derive(Accounts)]
pub struct WithdrawAAccounts<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    pub vault: Account<'info, Vault>,

    // mut needed because we are changing state
    #[account(mut)]
    pub vault_token_a_account: Account<'info, TokenAccount>,

    // mut needed because we are changing state
    #[account(mut)]
    pub admin_token_a_account: Account<'info, TokenAccount>,

    pub vault_proto_config: Account<'info, VaultProtoConfig>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminWithdrawAccounts<'info> {
    pub admin: Signer<'info>,

    pub vault_proto_config: Account<'info, VaultProtoConfig>,

    pub vault: Account<'info, Vault>,

    // mut needed because we are changing state
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    // mut needed because we are changing state
    #[account(mut)]
    pub destination_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClosePositionAccountAccounts<'info> {
    pub admin: Signer<'info>,

    pub vault_proto_config: Account<'info, VaultProtoConfig>,

    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub position: Account<'info, Position>,

    #[account(mut)]
    /// CHECK: We don't care what this account is
    pub sol_destination: AccountInfo<'info>,
}
