use crate::state::{Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::{prelude::*};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Approve, Mint};
use anchor_spl::token::{Token, TokenAccount};
use spl_token::state::AccountState;
use spl_token_swap::state::{SwapState, SwapV1};
use crate::math::get_exchange_rate;

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
            swap_fee_account.mint == swap_token_mint.key() &&
            swap_fee_account.owner == swap_authority.key()
        }
    )]
    pub swap_fee_account: Account<'info, TokenAccount>,

    // TODO: Hard-code the swap liquidity pool pubkey to the vault account so that trigger DCA source cannot game the system
    // And add appropriate checks
    /// CHECK: do checks in handler
    pub swap: AccountInfo<'info>,

    // TODO: Generate Authority ID defined in processor.rs. / authority_id
    /// CHECK: do checks in handler
    pub swap_authority: AccountInfo<'info>,

    // TODO: Test this is actually the Token swap program; clean this
    #[account(address = spl_token_swap::ID)]
    pub token_swap_program: AccountInfo<'info>,

    #[account(address = Token::id())]
    pub token_program: Program<'info, Token>,

    #[account(address = anchor_spl::associated_token::ID)]
    pub associated_token_program: Program<'info, AssociatedToken>,

    #[account(address = System::id())]
    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<TriggerDCA>) -> Result<()> {
    /* MANUAL CHECKS + COMPUTE (CHECKS) */

    /* STATE UPDATES (EFFECTS) */

    /* MANUAL CPI (INTERACTIONS) */

    // let swap_account_info = &ctx.accounts.swap;
    // let swap = SwapV1::unpack(swap_account_info.data.deref().borrow().deref())?;
    //
    // let now = Clock::get().unwrap().unix_timestamp;
    //
    // if !dca_allowed(ctx.accounts.vault.dca_activation_timestamp, now) {
    //     return Err(ErrorCode::DuplicateDCAError.into());
    // }
    //
    // let prev_vault_token_b_account_balance = ctx.accounts.vault_token_b_account.amount;
    //
    // swap_tokens(&ctx, ctx.accounts.vault.drip_amount, swap)?;
    //
    // let new_vault_token_b_account_balance = ctx.accounts.vault_token_b_account.amount;
    //
    // // For some reason swap did not happen ~ because we will never have swap amount of 0.
    // if prev_vault_token_b_account_balance == new_vault_token_b_account_balance {
    //     return Err(ErrorCode::IncompleteSwapError.into());
    // }
    //
    // let exchange_rate: u64 = get_exchange_rate(
    //     prev_vault_token_b_account_balance,
    //     new_vault_token_b_account_balance,
    //     ctx.accounts.vault.drip_amount,
    // );
    //
    // let vault = &mut ctx.accounts.vault;
    // let current_vault_period_account = &mut ctx.accounts.current_vault_period_account;
    // let last_vault_period_account = &mut ctx.accounts.last_vault_period_account;
    //
    // let new_twap = calculate_new_twap_amount(
    //     last_vault_period_account.twap,
    //     current_vault_period_account.period_id,
    //     exchange_rate,
    // );
    // current_vault_period_account.twap = new_twap;
    //
    // vault.last_dca_period = current_vault_period_account.period_id; // same as += 1
    //
    // // If any position(s) are closing at this period, the drip amount needs to be reduced
    // vault.drip_amount -= current_vault_period_account.dar;
    //
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
    // token::approve(
    //     CpiContext::new(
    //         ctx.accounts.token_program.to_account_info().clone(),
    //         Approve {
    //             to: ctx.accounts.vault_token_a_account.to_account_info().clone(),
    //             delegate: ctx.accounts.vault.to_account_info().clone(),
    //             authority: ctx.accounts.swap.to_account_info().clone(),
    //         },
    //     ),
    //     swap_amount,
    // )?;
    //
    // let min_slippage_amt = get_minimum_slippage_amount();
    //
    // let ix = spl_token_swap::instruction::swap(
    //     &ctx.accounts.token_swap_program.key(),
    //     &ctx.accounts.token_program.key(),
    //     &ctx.accounts.swap.key(),
    //     &ctx.accounts.swap_authority.key(),
    //     &ctx.accounts.swap.key(),
    //     &ctx.accounts.vault_token_a_account.key(),
    //     &ctx.accounts.swap_token_a_account.key(),
    //     &ctx.accounts.swap_token_b_account.key(),
    //     &ctx.accounts.vault_token_b_account.key(),
    //     swap.pool_mint(),
    //     swap.pool_fee_account(),
    //     None,
    //     spl_token_swap::instruction::Swap {
    //         amount_in: swap_amount,
    //         minimum_amount_out: min_slippage_amt,
    //     },
    // )?;
    //
    // //   The order in which swap accepts the accounts. (Adding it for now to refer/review easily)
    // //
    // //   0. `[]` Token-swap
    // //   1. `[]` swap authority
    // //   2. `[]` user transfer authority
    // //   3. `[writable]` token_(A|B) SOURCE Account, amount is transferable by user transfer authority,
    // //   4. `[writable]` token_(A|B) Base Account to swap INTO.  Must be the SOURCE token.
    // //   5. `[writable]` token_(A|B) Base Account to swap FROM.  Must be the DESTINATION token.
    // //   6. `[writable]` token_(A|B) DESTINATION Account assigned to USER as the owner.
    // //   7. `[writable]` Pool token mint, to generate trading fees
    // //   8. `[writable]` Fee account, to receive trading fees
    // //   9. '[]` Token program id
    // //   10 `[optional, writable]` Host fee account to receive additional trading fees
    //
    // solana_program::program::invoke_signed(
    //     &ix,
    //     &[
    //         ctx.accounts.token_swap_program.clone(),
    //         ctx.accounts.swap_authority.clone(),
    //         ctx.accounts.swap.clone(),
    //         ctx.accounts.vault_token_a_account.to_account_info().clone(),
    //         ctx.accounts.swap_token_a_account.to_account_info().clone(),
    //         ctx.accounts.swap_token_b_account.to_account_info().clone(),
    //         ctx.accounts.vault_token_b_account.to_account_info().clone(),
    //         ctx.accounts
    //             .swap_liquidity_pool_mint
    //             .to_account_info()
    //             .clone(),
    //         ctx.accounts
    //             .swap_liquidity_pool_fee
    //             .to_account_info()
    //             .clone(),
    //         ctx.accounts.token_program.to_account_info().clone(),
    //     ],
    //     &[&[
    //         b"dca-vault-v1".as_ref(),
    //         ctx.accounts.vault.token_a_mint.as_ref(),
    //         ctx.accounts.vault.token_b_mint.as_ref(),
    //         ctx.accounts.vault.proto_config.as_ref(),
    //         &[ctx.accounts.vault.bump],
    //     ]],
    // )
    // .map_err(Into::into)
    Ok(())
}

// TODO (matcha) Do the math
fn get_minimum_slippage_amount() -> u64 {
    return 1; // fake value for now
}
