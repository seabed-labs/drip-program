use crate::math::calculate_periodic_drip_amount;
use crate::state::{Position, Vault, VaultPeriod};
use anchor_lang::prelude::*;
use anchor_spl::token;
use anchor_spl::token::{Mint, MintTo, SetAuthority, Token, TokenAccount, Transfer};
use spl_token::instruction::AuthorityType;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositBumps {
    position: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositParams {
    bumps: DepositBumps,
    token_a_deposit_amount: u64,
    dca_cycles: u64,
}

#[derive(Accounts)]
#[instruction(params: DepositParams)]
pub struct Deposit<'info> {
    // Dcaf accounts
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub vault_period_end: Account<'info, VaultPeriod>,
    #[account(init, payer = depositor)]
    pub user_position: Account<'info, Position>, // TODO(matcha): PDA

    // Token mints
    pub token_a_mint: Account<'info, Mint>,
    #[account(
        init,
        mint::authority = vault,
        mint::decimals = 0,
        payer = depositor
    )]
    pub user_position_nft_mint: Account<'info, Mint>,

    // Token accounts
    pub vault_token_a_account: Account<'info, TokenAccount>,
    pub user_token_a_account: Account<'info, TokenAccount>,
    pub user_position_nft_account: Account<'info, TokenAccount>,

    // Other
    pub depositor: Signer<'info>,
    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Deposit>, params: DepositParams) -> ProgramResult {
    // TODO(matcha): Do validations that are not possible via eDSL

    // Take mutable references to init/mut accounts
    let vault = &mut ctx.accounts.vault;
    let vault_period_end = &mut ctx.accounts.vault_period_end;
    let position = &mut ctx.accounts.user_position;

    let periodic_drip_amount =
        calculate_periodic_drip_amount(params.token_a_deposit_amount, params.dca_cycles);

    // Make account modifications
    vault.increaase_drip_amount(periodic_drip_amount);
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
) -> ProgramResult {
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
) -> ProgramResult {
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

    // Set the mint authority for this position NFT mint to 0 so that new tokens cannot be minted
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
