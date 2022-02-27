use crate::common::ErrorCode::PeriodicDripAmountIsZero;
use crate::math::calculate_periodic_drip_amount;
use crate::state::{Position, Vault, VaultPeriod};
use anchor_lang::prelude::*;
use anchor_spl::token;
use anchor_spl::token::{Mint, MintTo, SetAuthority, Token, TokenAccount, Transfer};
use spl_token::instruction::AuthorityType;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositParams {
    token_a_deposit_amount: u64,
    dca_cycles: u64,
}

#[derive(Accounts)]
#[instruction(params: DepositParams)]
pub struct Deposit<'info> {
    // Dcaf accounts
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
            token_a_mint.to_account_info().owner == &Token::id() &&
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

    // Token accounts
    #[account(
        mut,
        constraint = {
            vault_token_a_account.to_account_info().owner == &Token::id() &&
            vault_token_a_account.mint == vault.token_a_mint &&
            vault_token_a_account.owner == vault.key()
        },
    )]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    // TODO(matcha): Revisit this and make sure this constraint makes sense
    #[account(
        mut,
        constraint = {
            user_token_a_account.to_account_info().owner == &Token::id() &&
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
        token::mint = user_position_nft_mint,
        token::authority = depositor,
        payer = depositor
    )]
    pub user_position_nft_account: Box<Account<'info, TokenAccount>>,

    // Other
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(address = Token::id())]
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    #[account(address = System::id())]
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Deposit>, params: DepositParams) -> Result<()> {
    // TODO(matcha): Do validations that are not possible via eDSL

    // Take mutable references to init/mut accounts
    let vault = &mut ctx.accounts.vault;
    let vault_period_end = &mut ctx.accounts.vault_period_end;
    let position = &mut ctx.accounts.user_position;

    let periodic_drip_amount =
        calculate_periodic_drip_amount(params.token_a_deposit_amount, params.dca_cycles);

    if periodic_drip_amount == 0 {
        return Err(PeriodicDripAmountIsZero.into());
    }

    // Make account modifications
    vault.increase_drip_amount(periodic_drip_amount);
    vault_period_end.increase_drip_amount_to_reduce(periodic_drip_amount);
    position.init(
        vault.key(),
        ctx.accounts.user_position_nft_mint.key(),
        params.token_a_deposit_amount,
        vault.last_dca_period,
        params.dca_cycles,
        periodic_drip_amount,
    );
    send_tokens(
        &ctx.accounts.token_program,
        &ctx.accounts.vault,
        &ctx.accounts.user_token_a_account,
        &ctx.accounts.vault_token_a_account,
        params.token_a_deposit_amount,
    )?;

    mint_position_nft(
        &ctx.accounts.token_program,
        &ctx.accounts.vault,
        &ctx.accounts.user_position_nft_mint,
        &ctx.accounts.user_position_nft_account,
    )?;

    Ok(())
}

fn send_tokens<'info>(
    token_program: &Program<'info, Token>,
    vault: &Account<'info, Vault>,
    from: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    amount: u64,
) -> Result<()> {
    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info().clone(),
            Transfer {
                from: from.to_account_info().clone(),
                to: to.to_account_info().clone(),
                authority: vault.to_account_info().clone(),
            },
            &[&vault.seeds()],
        ),
        amount,
    )
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
            &[&vault.seeds()],
        ),
        1,
    )?;

    // Set the mint authority for this position NFT mint to None so that new tokens cannot be minted
    token::set_authority(
        CpiContext::new_with_signer(
            token_program.to_account_info().clone(),
            SetAuthority {
                current_authority: vault.to_account_info().clone(),
                account_or_mint: mint.to_account_info().clone(),
            },
            &[&vault.seeds()],
        ),
        AuthorityType::MintTokens, // MintTokens
        None,
    )
}
