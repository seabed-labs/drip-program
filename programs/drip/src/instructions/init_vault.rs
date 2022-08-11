use crate::errors::ErrorCode;
use crate::events::Log;
use crate::state::{Vault, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use spl_token::state::AccountState;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeVaultParams {
    max_slippage_bps: u16,
    whitelisted_swaps: Vec<Pubkey>,
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    /* DRIP ACCOUNTS */
    #[account(
        init,
        space = 392,
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

    #[account(
        constraint = vault_proto_config.granularity != 0 @ErrorCode::InvalidGranularity,
        constraint = vault_proto_config.token_a_drip_trigger_spread < 5000 && vault_proto_config.token_b_withdrawal_spread < 5000 @ErrorCode::InvalidSpread,
    )]
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
    // mut neeed because we are initing accounts
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(address = anchor_spl::token::ID)]
    pub token_program: Program<'info, Token>,

    #[account(address = anchor_spl::associated_token::ID)]
    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<InitializeVault>, params: InitializeVaultParams) -> Result<()> {
    if params.whitelisted_swaps.len() > 5 {
        return Err(ErrorCode::InvalidNumSwaps.into());
    }
    let mut whitelisted_swaps: [Pubkey; 5] = Default::default();
    for (i, s) in params.whitelisted_swaps.iter().enumerate() {
        whitelisted_swaps[i] = *s;
    }
    /* MANUAL CHECKS + COMPUTE (CHECKS) */
    /* STATE UPDATES (EFFECTS) */
    ctx.accounts.vault.init(
        ctx.accounts.vault_proto_config.key(),
        ctx.accounts.token_a_mint.key(),
        ctx.accounts.token_b_mint.key(),
        ctx.accounts.token_a_account.key(),
        ctx.accounts.token_b_account.key(),
        ctx.accounts.treasury_token_b_account.key(),
        whitelisted_swaps,
        params.whitelisted_swaps.len() > 0,
        params.max_slippage_bps,
        ctx.accounts.vault_proto_config.granularity,
        ctx.bumps.get("vault"),
    )?;
    emit!(Log {
        data: None,
        message: "initialized Vault".to_string(),
    });
    /* MANUAL CPI (INTERACTIONS) */
    Ok(())
}
