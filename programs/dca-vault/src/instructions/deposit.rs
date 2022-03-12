use crate::errors::ErrorCode::PeriodicDripAmountIsZero;
use crate::interactions::transfer_token::TransferToken;
use crate::math::calculate_periodic_drip_amount;
use crate::state::{Position, Vault, VaultPeriod};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token;
use anchor_spl::token::{Mint, MintTo, Token, TokenAccount};
use spl_token::instruction::AuthorityType;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositParams {
    token_a_deposit_amount: u64,
    dca_cycles: u64,
}

#[derive(Accounts)]
#[instruction(params: DepositParams)]
pub struct Deposit<'info> {
    // TODO(matcha): Move other IX's vault validation to self-contained like this instead of passing in mints and proto config just to validate vault
    #[account(
        mut,
        seeds = [
            b"dca-vault-v1".as_ref(),
            vault.token_a_mint.as_ref(),
            vault.token_b_mint.as_ref(),
            vault.proto_config.as_ref()
        ],
        bump = vault.bump
    )]
    pub vault: Box<Account<'info, Vault>>,

    // TODO(matcha): Maybe move the constraint here to the handler and throw a custom error
    // TODO(matcha): Add PDA seed validation here
    #[account(
        mut,
        has_one = vault,
        constraint = {
            params.dca_cycles > 0 &&
            vault_period_end.period_id > 0 &&
            vault_period_end.period_id == vault.last_dca_period + params.dca_cycles
        }
    )]
    pub vault_period_end: Box<Account<'info, VaultPeriod>>,

    #[account(
        init,
        seeds = [
            b"user_position".as_ref(),
            vault.key().as_ref(),
            user_position_nft_mint.key().as_ref()
        ],
        bump,
        payer = depositor
    )]
    pub user_position: Box<Account<'info, Position>>,

    // Token mints
    #[account(
        constraint = {
            token_a_mint.key() == vault.token_a_mint
        },
    )]
    pub token_a_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        mint::authority = vault,
        mint::decimals = 0,
        payer = depositor
    )]
    pub user_position_nft_mint: Box<Account<'info, Mint>>,

    // TODO(matcha): Verify that this is an ATA (and all other places too)
    // Token accounts
    #[account(
        mut,
        constraint = {
            vault_token_a_account.mint == vault.token_a_mint &&
            vault_token_a_account.owner == vault.key()
        },
    )]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    // TODO(matcha): Revisit this and make sure this constraint makes sense
    #[account(
        mut,
        constraint = {
            user_token_a_account.mint == vault.token_a_mint &&
            user_token_a_account.owner == depositor.key() &&
            user_token_a_account.delegate.contains(&vault.key()) &&
            user_token_a_account.delegated_amount == params.token_a_deposit_amount &&
            params.token_a_deposit_amount > 0
        }
    )]
    pub user_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        associated_token::mint = user_position_nft_mint,
        associated_token::authority = depositor,
        payer = depositor
    )]
    pub user_position_nft_account: Box<Account<'info, TokenAccount>>,

    // Other
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(address = Token::id())]
    pub token_program: Program<'info, Token>,
    #[account(address = anchor_spl::associated_token::ID)]
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = System::id())]
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Deposit>, params: DepositParams) -> Result<()> {
    // TODO(matcha): Do validations that are not possible via eDSL
    /* MANUAL CHECKS + COMPUTE (CHECKS) */

    let periodic_drip_amount =
        calculate_periodic_drip_amount(params.token_a_deposit_amount, params.dca_cycles);

    if periodic_drip_amount == 0 {
        return Err(PeriodicDripAmountIsZero.into());
    }

    let token_transfer = TransferToken::new(
        &ctx.accounts.token_program,
        &ctx.accounts.user_token_a_account,
        &ctx.accounts.vault_token_a_account,
        params.token_a_deposit_amount,
    );

    /* STATE UPDATES (EFFECTS) */

    let vault_mut = &mut ctx.accounts.vault;
    let vault_period_end_mut = &mut ctx.accounts.vault_period_end;
    let position_mut = &mut ctx.accounts.user_position;

    vault_mut.increase_drip_amount(periodic_drip_amount);
    vault_period_end_mut.increase_drip_amount_to_reduce(periodic_drip_amount);
    position_mut.init(
        ctx.accounts.vault.key(),
        ctx.accounts.user_position_nft_mint.key(),
        params.token_a_deposit_amount,
        ctx.accounts.vault.last_dca_period,
        params.dca_cycles,
        periodic_drip_amount,
        ctx.bumps.get("user_position"),
    )?;

    /* MANUAL CPI (INTERACTIONS) */

    token_transfer.execute(&ctx.accounts.vault)?;

    mint_position_nft(
        &ctx.accounts.token_program,
        &ctx.accounts.vault,
        &ctx.accounts.user_position_nft_mint,
        &ctx.accounts.user_position_nft_account,
    )?;

    Ok(())
}

fn mint_position_nft<'info>(
    token_program: &Program<'info, Token>,
    vault: &Account<'info, Vault>,
    mint: &Account<'info, Mint>,
    to: &Account<'info, TokenAccount>,
) -> Result<()> {
    // Mint NFT to user
    token::mint_to(
        CpiContext::new_with_signer(
            token_program.to_account_info().clone(),
            MintTo {
                mint: mint.to_account_info().clone(),
                to: to.to_account_info().clone(),
                authority: vault.to_account_info().clone(),
            },
            &[&[
                b"dca-vault-v1".as_ref(),
                vault.token_a_mint.as_ref(),
                vault.token_b_mint.as_ref(),
                vault.proto_config.as_ref(),
                &[vault.bump],
            ]],
        ),
        1,
    )?;

    // Set the mint authority for this position NFT mint to None so that new tokens cannot be minted
    invoke_signed(
        &spl_token::instruction::set_authority(
            &token::ID,
            mint.to_account_info().key,
            None,
            AuthorityType::MintTokens,
            vault.to_account_info().key,
            &[vault.to_account_info().key],
        )?,
        &[
            mint.to_account_info().clone(),
            vault.to_account_info().clone(),
            token_program.to_account_info().clone(),
        ],
        &[&[
            b"dca-vault-v1".as_ref(),
            vault.token_a_mint.as_ref(),
            vault.token_b_mint.as_ref(),
            vault.proto_config.as_ref(),
            &[vault.bump],
        ]],
    )?;

    Ok(())
}
