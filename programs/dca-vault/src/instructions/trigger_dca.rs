use crate::state::{Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::{prelude::*, solana_program};
use anchor_spl::token;
use anchor_spl::token::Approve;
use anchor_spl::token::{Mint, Token, TokenAccount};
use spl_token_swap::solana_program::program_pack::Pack;
use spl_token_swap::state::{SwapState, SwapV1};
use std::borrow::Borrow;
use std::ops::Deref;
use std::str::FromStr;

use crate::common::ErrorCode;
use crate::math::{calculate_new_twap_amount, get_exchange_rate};

#[derive(Accounts)]
#[instruction()]
pub struct TriggerDCA<'info> {
    // User that triggers the DCA
    pub dca_trigger_source: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"dca-vault-v1".as_ref(),
            vault.token_a_mint.as_ref(),
            vault.token_b_mint.as_ref(),
            vault.proto_config.as_ref()
        ],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        constraint = {
            vault_proto_config.granularity != 0 &&
            vault_proto_config.key() == vault.proto_config
        }
    )]
    pub vault_proto_config: Account<'info, VaultProtoConfig>,

    #[account(
        mut,
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            vault.last_dca_period.to_string().as_bytes().as_ref()
        ],
        bump = current_vault_period_account.bump,
        constraint = current_vault_period_account.period_id.checked_add(vault.last_dca_period)
    )]
    pub current_vault_period_account: Account<'info, VaultPeriod>,

    #[account(
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            vault.last_dca_period.to_string().as_bytes().as_ref()
        ],
        bump = last_vault_period_account.bump,
        constraint = last_vault_period_account.period_id == vault.last_dca_period
    )]
    pub last_vault_period_account: Account<'info, VaultPeriod>,

    #[account(
        mut,
        constraint = {
            vault_token_a_account.mint == vault.token_a_mint &&
            vault_token_a_account.owner == vault.key()
        },
    )]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = {
            vault_token_b_account.mint == vault.token_b_mint &&
            vault_token_b_account.owner == vault.key()
        },
    )]
    pub vault_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = {
            swap_token_a_account.mint == vault.token_a_mint &&
            swap_token_a_account.owner == swap_liquidity_pool.key()
        },
    )]
    pub swap_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = {
            swap_token_b_account.mint == vault.token_b_mint &&
            swap_token_b_account.owner == swap_liquidity_pool.key()
        },
    )]
    pub swap_token_b_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: do checks in handler
    pub swap_liquidity_pool: AccountInfo<'info>,

    // TODO: Generate Authority ID defined in processor.rs. / authority_id
    /// CHECK: do checks in handler
    pub swap_authority: AccountInfo<'info>,

    // TODO: Test this is actually the Token swap program; clean this
    /// CHECK: do checks in handler
    pub token_swap_program: AccountInfo<'info>,

    #[account(address = Token::id())]
    pub token_program: Program<'info, Token>,

    #[account(address = System::id())]
    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<TriggerDCA>) -> Result<()> {
    let swap_account_info = &ctx.accounts.swap_liquidity_pool;
    let swap = SwapV1::unpack(swap_account_info.data.deref().borrow().deref())?;

    let now = Clock::get().unwrap().unix_timestamp;

    if !dca_allowed(ctx.accounts.vault.dca_activation_timestamp, now) {
        return Err(ErrorCode::DuplicateDCAError.into());
    }

    let prev_vault_token_b_account_balance = ctx.accounts.vault_token_b_account.amount;

    swap_tokens(&ctx, ctx.accounts.vault.drip_amount, swap)?;

    let new_vault_token_b_account_balance = ctx.accounts.vault_token_b_account.amount;

    // For some reason swap did not happen ~ because we will never have swap amount of 0.
    if prev_vault_token_b_account_balance == new_vault_token_b_account_balance {
        return Err(ErrorCode::IncompleteSwapError.into());
    }

    let exchange_rate: u64 = get_exchange_rate(
        prev_vault_token_b_account_balance,
        new_vault_token_b_account_balance,
        ctx.accounts.vault.drip_amount,
    );

    let vault = &mut ctx.accounts.vault;
    let current_vault_period_account = &mut ctx.accounts.current_vault_period_account;
    let last_vault_period_account = &mut ctx.accounts.last_vault_period_account;

    let new_twap = calculate_new_twap_amount(
        last_vault_period_account.twap,
        current_vault_period_account.period_id,
        exchange_rate,
    );
    current_vault_period_account.twap = new_twap;

    vault.last_dca_period = current_vault_period_account.period_id; // same as += 1

    // If any position(s) are closing at this period, the drip amount needs to be reduced
    vault.drip_amount -= current_vault_period_account.dar;

    Ok(())
}

fn dca_allowed(last_dca_activation_timetamp: i64, current_dca_trigger_time: i64) -> bool {
    return current_dca_trigger_time > last_dca_activation_timetamp;
}

/*
Invokes CPI to SPL's swap IX / Serum's Dex
swap ix requires lot other authority accounts for verification; add them later
*/
fn swap_tokens<'info>(ctx: &Context<TriggerDCA>, swap_amount: u64, swap: SwapV1) -> Result<()> {
    token::approve(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info().clone(),
            Approve {
                to: ctx.accounts.vault_token_a_account.to_account_info().clone(),
                delegate: ctx.accounts.vault.to_account_info().clone(),
                authority: ctx.accounts.swap_liquidity_pool.to_account_info().clone(),
            },
        ),
        swap_amount,
    )?;

    let min_slippage_amt = get_minimum_slippage_amount();

    let ix = spl_token_swap::instruction::swap(
        ctx.accounts.token_swap_program.key,
        ctx.accounts.token_program.key,
        &ctx.accounts.swap_liquidity_pool.key(),
        ctx.accounts.swap_authority.key,
        &ctx.accounts.swap_liquidity_pool.key(),
        &ctx.accounts.vault_token_a_account.key(),
        &ctx.accounts.swap_token_a_account.key(),
        &ctx.accounts.swap_token_b_account.key(),
        &ctx.accounts.vault_token_b_account.key(),
        swap.pool_mint(),
        swap.pool_fee_account(),
        None,
        spl_token_swap::instruction::Swap {
            amount_in: swap_amount,
            minimum_amount_out: min_slippage_amt,
        },
    )?;

    //   The order in which swap accepts the accounts. (Adding it for now to refer/review easily)
    //
    //   0. `[]` Token-swap
    //   1. `[]` swap authority
    //   2. `[]` user transfer authority
    //   3. `[writable]` token_(A|B) SOURCE Account, amount is transferable by user transfer authority,
    //   4. `[writable]` token_(A|B) Base Account to swap INTO.  Must be the SOURCE token.
    //   5. `[writable]` token_(A|B) Base Account to swap FROM.  Must be the DESTINATION token.
    //   6. `[writable]` token_(A|B) DESTINATION Account assigned to USER as the owner.
    //   7. `[writable]` Pool token mint, to generate trading fees
    //   8. `[writable]` Fee account, to receive trading fees
    //   9. '[]` Token program id
    //   10 `[optional, writable]` Host fee account to receive additional trading fees

    solana_program::program::invoke_signed(
        &ix,
        &[
            ctx.accounts.token_swap_program.clone(),
            ctx.accounts.swap_authority.clone(),
            ctx.accounts.swap_liquidity_pool.clone(),
            ctx.accounts.vault_token_a_account.to_account_info().clone(),
            ctx.accounts.swap_token_a_account.to_account_info().clone(),
            ctx.accounts.swap_token_b_account.to_account_info().clone(),
            ctx.accounts.vault_token_b_account.to_account_info().clone(),
            ctx.accounts
                .swap_liquidity_pool_mint
                .to_account_info()
                .clone(),
            ctx.accounts
                .swap_liquidity_pool_fee
                .to_account_info()
                .clone(),
            ctx.accounts.token_program.to_account_info().clone(),
        ],
        &[&[
            b"dca-vault-v1".as_ref(),
            ctx.accounts.vault.token_a_mint.as_ref(),
            ctx.accounts.vault.token_b_mint.as_ref(),
            ctx.accounts.vault.proto_config.as_ref(),
            &[ctx.accounts.vault.bump],
        ]],
    )
    .map_err(Into::into)
}

// TODO (matcha) Do the math
fn get_minimum_slippage_amount() -> u64 {
    return 1; // fake value for now
}
