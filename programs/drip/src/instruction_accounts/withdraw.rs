use crate::errors::DripError;
use crate::state::{Position, Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::Mint;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
pub struct WithdrawCommonAccounts<'info> {
    pub withdrawer: Signer<'info>,

    /* DRIP ACCOUNTS */
    #[account(
        // mut needed for close_position
        mut,
        seeds = [
            b"drip-v1".as_ref(),
            vault.token_a_mint.as_ref(),
            vault_token_b_account.mint.as_ref(),
            vault_proto_config.key().as_ref()
        ],
        bump = vault.bump
    )]
    pub vault: Box<Account<'info, Vault>>,

    #[account(
        constraint = vault_proto_config.key() == vault.proto_config @DripError::InvalidVaultProtoConfigReference
    )]
    pub vault_proto_config: Box<Account<'info, VaultProtoConfig>>,

    #[account(
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            vault_period_i.period_id.to_string().as_bytes(),
        ],
        bump = vault_period_i.bump,
        constraint = vault_period_i.vault == vault.key() @DripError::InvalidVaultReference,
        constraint = vault_period_i.period_id == user_position.drip_period_id_before_deposit @DripError::InvalidVaultPeriod,
    )]
    pub vault_period_i: Account<'info, VaultPeriod>,

    #[account(
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            vault_period_j.period_id.to_string().as_bytes(),
        ],
        bump = vault_period_j.bump,
        constraint = vault_period_j.vault == vault.key() @DripError::InvalidVaultReference,
        constraint = vault_period_j.period_id == std::cmp::min(
            vault.last_drip_period,
            user_position.drip_period_id_before_deposit.checked_add(user_position.number_of_swaps).unwrap()
        ) @DripError::InvalidVaultPeriod,
    )]
    pub vault_period_j: Account<'info, VaultPeriod>,

    #[account(
        // mut needed because we are updating withdrawn amount
        mut,
        seeds = [
            b"user_position".as_ref(),
            user_position.position_authority.as_ref()
        ],
        bump = user_position.bump,
        constraint = user_position.vault == vault.key() @DripError::InvalidVaultReference,
        constraint = !user_position.is_closed @DripError::PositionAlreadyClosed,
    )]
    pub user_position: Account<'info, Position>,

    /* TOKEN ACCOUNTS */
    #[account(
        // mut needed for close_position 
        mut,
        constraint = user_position_nft_account.mint == user_position.position_authority @DripError::InvalidMint,
        constraint = user_position_nft_account.owner == withdrawer.key(),
        constraint = user_position_nft_account.amount == 1,
    )]
    pub user_position_nft_account: Account<'info, TokenAccount>,

    #[account(
        // mut needed because we are changing the balance
        mut,
        constraint = vault_token_b_account.key() == vault.token_b_account,
    )]
    pub vault_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = vault_treasury_token_b_account.key() == vault.treasury_token_b_account,
    )]
    pub vault_treasury_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing the balance
        mut,
        constraint = user_token_b_account.owner == withdrawer.key(),
        constraint = user_token_b_account.mint == vault_token_b_account.mint @DripError::InvalidMint,
    )]
    pub user_token_b_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: if empty or == system program, ignore, if present this should match position.referrer
    pub referrer: UncheckedAccount<'info>,

    /* MISC */
    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct WithdrawBAccounts<'info> {
    // TODO: Do we want to nest like this even if there are no new fields?
    pub common: WithdrawCommonAccounts<'info>,
}

#[derive(Accounts)]
pub struct ClosePositionAccounts<'info> {
    pub common: WithdrawCommonAccounts<'info>,

    #[account(
        // mut needed because we are changing state
        mut,
        seeds = [
            b"vault_period".as_ref(),
            common.vault.key().as_ref(),
            vault_period_user_expiry.period_id.to_string().as_bytes(),
        ],
        bump = vault_period_user_expiry.bump,
        constraint = vault_period_user_expiry.vault == common.vault.key() @DripError::InvalidVaultReference,
        constraint = vault_period_user_expiry.period_id == common.user_position.drip_period_id_before_deposit
                .checked_add(common.user_position.number_of_swaps)
                .unwrap() @DripError::InvalidVaultPeriod,
    )]
    pub vault_period_user_expiry: Box<Account<'info, VaultPeriod>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = vault_token_a_account.key() == common.vault.token_a_account,
    )]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = user_token_a_account.owner == common.withdrawer.key(),
        constraint = user_token_a_account.mint == common.vault.token_a_mint @DripError::InvalidMint
    )]
    pub user_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are burning the users NFT
        mut,
        constraint = user_position_nft_mint.key() == common.user_position.position_authority @DripError::InvalidMint,
        constraint = user_position_nft_mint.supply == 1,
        constraint = user_position_nft_mint.decimals == 0,
        constraint = user_position_nft_mint.is_initialized,
        constraint = user_position_nft_mint.mint_authority.is_none(),
        constraint = user_position_nft_mint.freeze_authority.is_none()
    )]
    pub user_position_nft_mint: Box<Account<'info, Mint>>,
}
