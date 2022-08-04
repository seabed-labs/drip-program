use crate::errors::ErrorCode;
use crate::events::Log;
use crate::interactions::transfer_token::TransferToken;
use crate::math::calculate_spread_amount;
use crate::state::{Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use spl_token::state::AccountState;
use std::str::FromStr;
use whirlpool::state::{TickArray, Whirlpool};

#[derive(Clone)]
pub struct WhirlpoolProgram;

impl anchor_lang::Id for WhirlpoolProgram {
    fn id() -> Pubkey {
        Pubkey::from_str(&"whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc")
            .expect("Error creating hardcoded pubkey")
    }
}

#[derive(Accounts)]
pub struct DripOrcaWhirlpool<'info> {
    // User that triggers the Drip
    pub drip_trigger_source: Signer<'info>,

    #[account(
        // mut needed
        mut,
        seeds = [
            b"drip-v1".as_ref(),
            vault.token_a_mint.as_ref(),
            vault.token_b_mint.as_ref(),
            vault.proto_config.as_ref()
        ],
        bump = vault.bump,
    )]
    pub vault: Box<Account<'info, Vault>>,

    #[account(
        constraint = vault_proto_config.granularity != 0,
        constraint = vault_proto_config.key() == vault.proto_config
    )]
    pub vault_proto_config: Box<Account<'info, VaultProtoConfig>>,

    #[account(
        seeds = [
            b"vault_period".as_ref(),
            last_vault_period.vault.as_ref(),
            last_vault_period.period_id.to_string().as_bytes().as_ref()
        ],
        bump = last_vault_period.bump,
        constraint = last_vault_period.period_id == vault.last_drip_period,
        constraint = last_vault_period.vault == vault.key()
    )]
    pub last_vault_period: Box<Account<'info, VaultPeriod>>,

    #[account(
        // mut needed because we are changing state
        mut,
        seeds = [
            b"vault_period".as_ref(),
            current_vault_period.vault.as_ref(),
            current_vault_period.period_id.to_string().as_bytes().as_ref()
        ],
        bump = current_vault_period.bump,
        constraint = current_vault_period.period_id == vault.last_drip_period.checked_add(1).unwrap(),
        constraint = current_vault_period.vault == vault.key()
    )]
    pub current_vault_period: Box<Account<'info, VaultPeriod>>,

    #[account(
        constraint = token_a_mint.key() == vault.token_a_mint @ErrorCode::InvalidMint,
        constraint = token_a_mint.is_initialized
    )]
    pub token_a_mint: Box<Account<'info, Mint>>,

    #[account(
        constraint = token_b_mint.key() == vault.token_b_mint @ErrorCode::InvalidMint,
        constraint = token_b_mint.is_initialized
    )]
    pub token_b_mint: Box<Account<'info, Mint>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        associated_token::mint = token_a_mint,
        associated_token::authority = vault,
        constraint = vault_token_a_account.state == AccountState::Initialized,
        constraint = vault_token_a_account.amount >= vault.drip_amount
    )]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        associated_token::mint = token_b_mint,
        associated_token::authority = vault,
        constraint = vault_token_b_account.state == AccountState::Initialized
    )]
    pub vault_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = swap_token_a_account.mint == vault.token_a_mint @ErrorCode::InvalidMint,
        constraint = swap_token_a_account.owner == whirlpool.key(),
        constraint = swap_token_a_account.state == AccountState::Initialized,
    )]
    pub swap_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = swap_token_b_account.mint == vault.token_b_mint @ErrorCode::InvalidMint,
        constraint = swap_token_b_account.owner == whirlpool.key(),
        constraint = swap_token_b_account.state == AccountState::Initialized
    )]
    pub swap_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = drip_fee_token_a_account.mint == vault.token_a_mint @ErrorCode::InvalidMint,
        constraint = drip_fee_token_a_account.state == AccountState::Initialized
    )]
    pub drip_fee_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(address = Token::id())]
    pub token_program: Program<'info, Token>,

    #[account(address = anchor_spl::associated_token::ID)]
    pub associated_token_program: Program<'info, AssociatedToken>,

    pub whirlpool_program: Program<'info, WhirlpoolProgram>,

    #[account(address = System::id())]
    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,

    #[account(mut)]
    pub whirlpool: Box<Account<'info, Whirlpool>>,

    #[account(mut)]
    pub tick_array_0: AccountLoader<'info, TickArray>,

    #[account(mut)]
    pub tick_array_1: AccountLoader<'info, TickArray>,

    #[account(mut)]
    pub tick_array_2: AccountLoader<'info, TickArray>,

    #[account(
        seeds = [b"oracle", whirlpool.key().as_ref()], 
        bump,
        seeds::program = whirlpool_program.key()
    )]
    /// CHECK: Oracle is currently unused and will be enabled on subsequent updates
    pub oracle: UncheckedAccount<'info>,
}

// TODO(Mocha/Matcha): Extra common code between drip_* instructions
pub fn handler(ctx: Context<DripOrcaWhirlpool>) -> Result<()> {
    // TODO(Mocha): We could do this check as an eDSL constraint with custom error
    if ctx.accounts.vault_token_a_account.amount == 0 {
        return Err(ErrorCode::PeriodicDripAmountIsZero.into());
    }
    if ctx.accounts.vault.limit_swaps {
        if !ctx
            .accounts
            .vault
            .whitelisted_swaps
            .contains(&ctx.accounts.whirlpool.key().clone())
        {
            return Err(ErrorCode::InvalidSwapAccount.into());
        }
    }
    if !ctx.accounts.vault.is_drip_activated() {
        return Err(ErrorCode::DuplicateDripError.into());
    }

    /* STATE UPDATES (EFFECTS) */

    let current_balance_a = ctx.accounts.vault_token_a_account.amount;
    emit!(Log {
        data: Some(current_balance_a),
        message: "vault a balance".to_string(),
    });

    let current_balance_b = ctx.accounts.vault_token_b_account.amount;
    emit!(Log {
        data: Some(current_balance_b),
        message: "vault b balance".to_string(),
    });
    // Use drip_amount becasue it may change after process_drip
    let drip_trigger_spread_amount = calculate_spread_amount(
        ctx.accounts.vault.drip_amount,
        ctx.accounts.vault_proto_config.token_a_drip_trigger_spread,
    );
    let swap_amount = ctx
        .accounts
        .vault
        .drip_amount
        .checked_sub(drip_trigger_spread_amount)
        .unwrap();
    let vault = &mut ctx.accounts.vault;
    vault.process_drip(
        &ctx.accounts.current_vault_period,
        ctx.accounts.vault_proto_config.granularity,
    );

    let drip_trigger_fee_transfer = TransferToken::new(
        &ctx.accounts.token_program,
        &ctx.accounts.vault_token_a_account,
        &ctx.accounts.drip_fee_token_a_account,
        drip_trigger_spread_amount,
    );

    /* MANUAL CPI (INTERACTIONS) */
    // TODO
    swap_tokens()?;

    drip_trigger_fee_transfer.execute(&ctx.accounts.vault)?;

    ctx.accounts.drip_fee_token_a_account.reload()?;
    ctx.accounts.vault_token_a_account.reload()?;
    ctx.accounts.vault_token_b_account.reload()?;

    let new_drip_trigger_fee_balance_a = ctx.accounts.drip_fee_token_a_account.amount;
    emit!(Log {
        data: Some(new_drip_trigger_fee_balance_a),
        message: "new drip trigger fee a balance".to_string(),
    });

    let new_balance_a = ctx.accounts.vault_token_a_account.amount;
    emit!(Log {
        data: Some(new_balance_a),
        message: "new vault a balance".to_string(),
    });

    let new_balance_b = ctx.accounts.vault_token_b_account.amount;
    emit!(Log {
        data: Some(new_balance_b),
        message: "new vault b balance".to_string(),
    });

    // TODO: Think of a way to compute this without actually making the CPI call so that we can follow checks-effects-interactions
    let received_b = new_balance_b.checked_sub(current_balance_b).unwrap();

    // For some reason swap did not happen ~ because we will never have swap amount of 0.
    if received_b == 0 {
        return Err(ErrorCode::IncompleteSwapError.into());
    }

    let current_period_mut = &mut ctx.accounts.current_vault_period;
    current_period_mut.update_twap(&ctx.accounts.last_vault_period, swap_amount, received_b);
    current_period_mut.update_drip_timestamp();

    Ok(())
}

// TODO
fn swap_tokens<'info>() -> Result<()> {
    Ok(())
}
