use crate::errors::ErrorCode;
use crate::events::Log;
use crate::interactions::transfer_token::TransferToken;
use crate::math::calculate_spread_amount;
use crate::sign;
use crate::state::{Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::solana_program::hash::hashv;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::{prelude::*, solana_program};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use spl_token::state::AccountState;
use std::str::FromStr;
use whirlpool::state::Whirlpool;

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
        constraint = swap_token_a_account.owner == whirlpool.key(),
        constraint = swap_token_a_account.state == AccountState::Initialized,
    )]
    pub swap_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
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
    /// CHECK: Checked by Whirlpool
    pub tick_array_0: UncheckedAccount<'info>,

    #[account(mut)]
    /// CHECK: Checked by Whirlpool
    pub tick_array_1: UncheckedAccount<'info>,

    #[account(mut)]
    /// CHECK: Checked by Whirlpool
    pub tick_array_2: UncheckedAccount<'info>,

    #[account(
        seeds = [b"oracle", whirlpool.key().as_ref()], 
        bump,
        seeds::program = whirlpool_program.key()
    )]
    /// CHECK: Oracle is currently unused and will be enabled on subsequent updates
    pub oracle: UncheckedAccount<'info>,
}

// TODO(Mocha/Matcha): extract common code between drip_* instructions
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
    let current_drip_amount = ctx.accounts.vault.drip_amount;
    msg!("drip_amount {:?}", current_drip_amount);

    let current_balance_a = ctx.accounts.vault_token_a_account.amount;
    msg!("current_balance_a {:?}", current_balance_a);

    let current_balance_b = ctx.accounts.vault_token_b_account.amount;
    msg!("current_balance_b {:?}", current_balance_b);

    // Use drip_amount becasue it may change after process_drip
    let drip_trigger_spread_amount = calculate_spread_amount(
        current_drip_amount,
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
    swap_tokens(
        &ctx.accounts.vault,
        &ctx.accounts.vault_token_a_account,
        &ctx.accounts.vault_token_b_account,
        &ctx.accounts.token_program,
        &ctx.accounts.whirlpool_program,
        &ctx.accounts.whirlpool,
        &ctx.accounts.swap_token_a_account,
        &ctx.accounts.swap_token_b_account,
        &ctx.accounts.tick_array_0,
        &ctx.accounts.tick_array_1,
        &ctx.accounts.tick_array_2,
        &ctx.accounts.oracle,
        swap_amount,
    )?;

    drip_trigger_fee_transfer.execute(&ctx.accounts.vault)?;

    ctx.accounts.drip_fee_token_a_account.reload()?;
    ctx.accounts.vault_token_a_account.reload()?;
    ctx.accounts.vault_token_b_account.reload()?;

    let new_drip_trigger_fee_balance_a = ctx.accounts.drip_fee_token_a_account.amount;
    msg!(
        "new_drip_trigger_fee_balance_a {:?}",
        new_drip_trigger_fee_balance_a
    );

    let new_balance_a = ctx.accounts.vault_token_a_account.amount;
    msg!("new_balance_a {:?}", new_balance_a);

    let new_balance_b = ctx.accounts.vault_token_b_account.amount;
    msg!("new_balance_b {:?}", new_balance_b);

    // TODO: Think of a way to compute this without actually making the CPI call so that we can follow checks-effects-interactions
    let received_b = new_balance_b.checked_sub(current_balance_b).unwrap();
    let swapped_a = current_balance_a.checked_sub(new_balance_a).unwrap();

    // For some reason swap did not happen ~ because we will never have swap amount of 0.
    // If we ever swap more then the drip amount, we should error out as it will prevent us from doing the last drip
    if received_b == 0
        || i128::from(swapped_a)
            .checked_sub(i128::from(current_drip_amount))
            .unwrap()
            > 0
    {
        return Err(ErrorCode::IncompleteSwapError.into());
    }

    let current_period_mut = &mut ctx.accounts.current_vault_period;
    current_period_mut.update_twap(&ctx.accounts.last_vault_period, swap_amount, received_b);
    current_period_mut.update_drip_timestamp();

    Ok(())
}

use borsh::BorshSerialize;

#[derive(BorshSerialize)]
struct WhirlpoolSwapParams {
    amount: u64,
    other_amount_threshold: u64,
    sqrt_price_limit: u128,
    amount_specified_is_input: bool,
    a_to_b: bool, // Zero for one
}

fn swap_tokens<'info>(
    vault: &Account<'info, Vault>,
    vault_token_a_account: &Account<'info, TokenAccount>,
    vault_token_b_account: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    whirlpool_program: &Program<'info, WhirlpoolProgram>,
    whirlpool: &Account<'info, Whirlpool>,
    whirlpool_token_vault_a: &Account<'info, TokenAccount>,
    whirlpool_token_vault_b: &Account<'info, TokenAccount>,
    tick_array_0: &UncheckedAccount<'info>,
    tick_array_1: &UncheckedAccount<'info>,
    tick_array_2: &UncheckedAccount<'info>,
    oracle: &UncheckedAccount<'info>,
    swap_amount: u64,
) -> Result<()> {
    emit!(Log {
        data: None,
        message: "starting CPI flow".to_string(),
    });
    let a_to_b = if vault_token_a_account.mint.key() == whirlpool_token_vault_a.mint.key() {
        true
    } else {
        false
    };
    msg!(&format!("a_to_b: {a_to_b}"));
    // TODO: What should the sqrt_price_limit be?
    let sqrt_price_limit = if a_to_b {
        // Price decreases
        // We want -10% of the current price
        // new_price = old_price * 0.9
        // new_sqrt_price = old_sqrt_price * sqrt(0.9)
        // new_sqrt_price = (old_sqrt_price * 9486) / 1e4
        whirlpool
            .sqrt_price
            .checked_mul(9486)
            .expect("lower new sqrt price calc failed 1")
            .checked_div(10000)
            .expect("lower new sqrt price calc failed 2")
    } else {
        // Price increases
        // We want +10% of the current price
        // new_price = old_price * 1.1
        // new_sqrt_price = old_sqrt_price * sqrt(1.1)
        // new_sqrt_price = (old_sqrt_price * 10488) / 1e4
        whirlpool
            .sqrt_price
            .checked_mul(10488)
            .expect("higher new sqrt price calc failed 1")
            .checked_div(10000)
            .expect("higher new sqrt price calc failed 2")
    };
    let params = WhirlpoolSwapParams {
        amount: swap_amount,
        other_amount_threshold: 0,
        sqrt_price_limit,
        amount_specified_is_input: true,
        a_to_b, // Zero for one
    };
    let mut buffer: Vec<u8> = Vec::new();
    params.serialize(&mut buffer).unwrap();

    let (vault_whirlpool_token_a_account, vault_whirlpool_token_b_account) = if a_to_b {
        (vault_token_a_account, vault_token_b_account)
    } else {
        (vault_token_b_account, vault_token_a_account)
    };

    let ix: Instruction = Instruction {
        program_id: whirlpool_program.key(),
        accounts: vec![
            AccountMeta::new_readonly(*token_program.key, false),
            AccountMeta::new_readonly(vault.key(), true),
            AccountMeta::new(whirlpool.key(), false),
            AccountMeta::new(vault_whirlpool_token_a_account.key(), false),
            AccountMeta::new(whirlpool_token_vault_a.key(), false),
            AccountMeta::new(vault_whirlpool_token_b_account.key(), false),
            AccountMeta::new(whirlpool_token_vault_b.key(), false),
            AccountMeta::new(tick_array_0.key(), false),
            AccountMeta::new(tick_array_1.key(), false),
            AccountMeta::new(tick_array_2.key(), false),
            AccountMeta::new_readonly(oracle.key(), false),
        ],
        data: [hashv(&[b"global:swap"]).to_bytes()[..8].to_vec(), buffer].concat(),
    };

    solana_program::program::invoke_signed(
        &ix,
        &[
            token_program.to_account_info().clone(),
            vault.to_account_info().clone(),
            whirlpool.to_account_info().clone(),
            vault_whirlpool_token_a_account.to_account_info().clone(),
            whirlpool_token_vault_a.to_account_info().clone(),
            vault_whirlpool_token_b_account.to_account_info().clone(),
            whirlpool_token_vault_b.to_account_info().clone(),
            tick_array_0.to_account_info().clone(),
            tick_array_1.to_account_info().clone(),
            tick_array_2.to_account_info().clone(),
            oracle.to_account_info().clone(),
        ],
        &[sign!(vault)],
    )?;
    Ok(())
}
