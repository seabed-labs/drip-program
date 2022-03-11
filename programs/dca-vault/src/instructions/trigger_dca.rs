use crate::errors::ErrorCode;
use crate::sign;
use crate::state::{Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token;
use anchor_spl::token::{Approve, Mint};
use anchor_spl::token::{Token, TokenAccount};
use spl_token::state::AccountState;
use spl_token_swap::constraints::SWAP_CONSTRAINTS;
use spl_token_swap::solana_program::program_pack::Pack;
use spl_token_swap::state::SwapV1;
use std::ops::Deref;

// TODO(latte): Limit the set of swap accounts that can be passed in for each vault

#[derive(Accounts)]
#[instruction()]
pub struct TriggerDCA<'info> {
    // User that triggers the DCA
    #[account(mut)]
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
        seeds = [
            b"vault_period".as_ref(),
            last_vault_period.vault.as_ref(),
            last_vault_period.period_id.to_string().as_bytes().as_ref()
        ],
        bump = last_vault_period.bump,
        constraint = {
            last_vault_period.period_id == vault.last_dca_period &&
            last_vault_period.vault == vault.key()
        }
    )]
    pub last_vault_period: Account<'info, VaultPeriod>,

    #[account(
        mut,
        seeds = [
            b"vault_period".as_ref(),
            current_vault_period.vault.as_ref(),
            current_vault_period.period_id.to_string().as_bytes().as_ref()
        ],
        bump = current_vault_period.bump,
        constraint = {
            current_vault_period.period_id == vault.last_dca_period.checked_add(1).unwrap() &&
            current_vault_period.vault == vault.key()
        }
    )]
    pub current_vault_period: Account<'info, VaultPeriod>,

    #[account(
        constraint = {
            swap_token_mint.mint_authority.contains(&swap_authority.key()) &&
            swap_token_mint.is_initialized
        }
    )]
    pub swap_token_mint: Account<'info, Mint>,

    #[account(
        constraint = {
            token_a_mint.key() == vault.token_a_mint &&
            token_a_mint.is_initialized
        }
    )]
    pub token_a_mint: Account<'info, Mint>,

    #[account(
        constraint = {
            token_b_mint.key() == vault.token_b_mint &&
            token_b_mint.is_initialized
        }
    )]
    pub token_b_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_a_mint,
        associated_token::authority = vault,
        constraint = {
            vault_token_a_account.state == AccountState::Initialized &&
            vault_token_a_account.amount >= vault.drip_amount
        }
    )]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = token_b_mint,
        associated_token::authority = vault,
        constraint = {
            vault_token_b_account.state == AccountState::Initialized
        },
    )]
    pub vault_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = {
            swap_token_a_account.mint == vault.token_a_mint &&
            swap_token_a_account.owner == swap_authority.key() &&
            swap_token_a_account.state == AccountState::Initialized
        },
    )]
    pub swap_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = {
            swap_token_b_account.mint == vault.token_b_mint &&
            swap_token_b_account.owner == swap_authority.key() &&
            swap_token_b_account.state == AccountState::Initialized
        },
    )]
    pub swap_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = {
            swap_fee_account.mint == swap_token_mint.key()
        }
    )]
    pub swap_fee_account: Account<'info, TokenAccount>,

    // TODO: Read through process_swap and other IXs in spl-token-swap program and mirror checks here
    // TODO: Hard-code the swap liquidity pool pubkey to the vault account so that trigger DCA source cannot game the system
    // And add appropriate checks
    #[account(
        constraint = swap.owner == &spl_token_swap::ID
    )]
    // TODO: Do one last check to see if this can be type checked by creating an anchor-wrapped type (there probably is a way)
    /// CHECK: Swap account cannot be serialized
    pub swap: AccountInfo<'info>,

    // TODO: Verify swap_authority PDA according to logic in processor.rs. / authority_id
    #[account(
        constraint = swap.owner == &spl_token_swap::ID
    )]
    // TODO: We might be able to implement an anchor compatible type for this
    /// CHECK: Swap authority is an arbitrary PDA, but should try and check still
    pub swap_authority: AccountInfo<'info>,

    // TODO: Test this is actually the Token swap program; clean this
    #[account(address = spl_token_swap::ID)]
    // TODO: We can implement an anchor compatible type for this easily
    /// CHECK: Swap program has no type?
    pub token_swap_program: AccountInfo<'info>,

    #[account(address = Token::id())]
    pub token_program: Program<'info, Token>,

    #[account(address = anchor_spl::associated_token::ID)]
    pub associated_token_program: Program<'info, AssociatedToken>,

    #[account(address = System::id())]
    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(mut ctx: Context<TriggerDCA>) -> Result<()> {
    /* MANUAL CHECKS + COMPUTE (CHECKS) */

    let swap_account_info = &ctx.accounts.swap;
    let swap = SwapV1::unpack(&swap_account_info.data.deref().borrow())?;

    let expected_swap_authority = Pubkey::create_program_address(
        &[&swap_account_info.key.to_bytes()[..32], &[swap.nonce]],
        &spl_token_swap::ID,
    )
    .unwrap();

    if expected_swap_authority != ctx.accounts.swap_authority.key() {
        return Err(ErrorCode::InvalidSwapAuthorityAccount.into());
    }

    if swap.pool_fee_account != ctx.accounts.swap_fee_account.key() {
        return Err(ErrorCode::InvalidSwapFeeAccount.into());
    }

    if !ctx.accounts.vault.is_dca_activated() {
        return Err(ErrorCode::DuplicateDCAError.into());
    }

    /* STATE UPDATES (EFFECTS) */

    let current_balance_b = ctx.accounts.vault_token_b_account.amount;
    // Save sent_a since drip_amount is going to change
    let sent_a = ctx.accounts.vault.drip_amount;

    let vault = &mut ctx.accounts.vault;
    vault.process_drip(
        &ctx.accounts.current_vault_period,
        ctx.accounts.vault_proto_config.granularity,
    );

    /* MANUAL CPI (INTERACTIONS) */
    let swap_amount = ctx.accounts.vault.drip_amount;
    swap_tokens(&mut ctx, swap_amount, &swap)?;

    let new_balance_b = ctx.accounts.vault_token_b_account.amount;
    // TODO: Think of a way to compute this without actually making the CPI call so that we can follow checks-effects-interactions
    let received_b = new_balance_b.checked_sub(current_balance_b).unwrap();

    // For some reason swap did not happen ~ because we will never have swap amount of 0.
    if received_b == 0 {
        return Err(ErrorCode::IncompleteSwapError.into());
    }

    let current_period_mut = &mut ctx.accounts.current_vault_period;
    current_period_mut.update_twap(&ctx.accounts.last_vault_period, sent_a, received_b);

    Ok(())
}

/*
    Invokes CPI to SPL's Token Swap
    swap ix requires lot other authority accounts for verification; add them later
*/
fn swap_tokens<'info>(
    ctx: &mut anchor_lang::context::Context<TriggerDCA>,
    swap_amount: u64,
    swap: &SwapV1,
) -> Result<()> {
    token::approve(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info().clone(),
            Approve {
                to: ctx.accounts.vault_token_a_account.to_account_info().clone(),
                delegate: ctx.accounts.vault.to_account_info().clone(),
                authority: ctx.accounts.swap.to_account_info().clone(),
            },
        ),
        swap_amount,
    )?;

    // Get swap's token A balance = X
    // Get swap's token B balance = Y
    // Invariant of a Univ2 style swap: XY = K
    // TODO: K = XY
    // Swapping x -> y
    // (X + x)(Y - y) = K // Derivation
    // (Y - y) = K/(X + x) // Derivation
    // TODO: y = Y - (K / (X + x))
    // Define slippage tolerance = s denominated in %
    // slippage = 10%
    // y_min = (y * (100 - 10)) / 100 => y * 90/100 = 90% of y (which is the same as 10% slippage)
    // TODO: y_min = (y * (100 - s))
    // TODO: Encapsulate all the logic above into a function like the one below
    let min_amount_out = get_minimum_out(swap_amount);

    let ix = spl_token_swap::instruction::swap(
        &ctx.accounts.token_swap_program.key(),
        &ctx.accounts.token_program.key(),
        &ctx.accounts.swap.key(),
        &ctx.accounts.swap_authority.key(),
        &ctx.accounts.swap_authority.key(),
        &ctx.accounts.vault_token_a_account.key(),
        &swap.token_a,
        &swap.token_b,
        &ctx.accounts.vault_token_b_account.key(),
        &swap.pool_mint,
        &swap.pool_fee_account,
        None,
        spl_token_swap::instruction::Swap {
            amount_in: swap_amount,
            minimum_amount_out: min_amount_out,
        },
    )?;

    let vault = &mut ctx.accounts.vault;

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
            ctx.accounts.swap.clone(),
            ctx.accounts.vault_token_a_account.to_account_info().clone(),
            ctx.accounts.swap_token_a_account.to_account_info().clone(),
            ctx.accounts.swap_token_b_account.to_account_info().clone(),
            ctx.accounts.vault_token_b_account.to_account_info().clone(),
            ctx.accounts.swap_token_mint.to_account_info().clone(),
            ctx.accounts.swap_fee_account.to_account_info().clone(),
            ctx.accounts.token_program.to_account_info().clone(),
        ],
        &[sign!(vault)],
    )
    .map_err(Into::into)
}

// TODO (matcha) Do the math
fn get_minimum_out(amount_in: u64) -> u64 {
    return 1; // fake value for now
}
