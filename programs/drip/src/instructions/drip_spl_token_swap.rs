use crate::errors::ErrorCode;
use crate::interactions::transfer_token::TransferToken;
use crate::math::calculate_spread_amount;
use crate::sign;
use crate::state::{Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::Mint;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Clone)]
pub struct TokenSwap;

impl Id for TokenSwap {
    fn id() -> Pubkey {
        spl_token_swap::ID
    }
}

#[derive(Accounts)]
pub struct DripSPLTokenSwap<'info> {
    // User that triggers the Drip
    pub drip_trigger_source: Signer<'info>,

    #[account(
        // mut needed because we're changing state
        mut,
        seeds = [
            b"drip-v1".as_ref(),
            token_a_mint.key().as_ref(),
            token_b_mint.key().as_ref(),
            vault_proto_config.key().as_ref()
        ],
        bump = vault.bump,
    )]
    pub vault: Box<Account<'info, Vault>>,

    #[account(
        constraint = vault_proto_config.key() == vault.proto_config @ErrorCode::InvalidVaultProtoConfigReference
    )]
    pub vault_proto_config: Box<Account<'info, VaultProtoConfig>>,

    #[account(
        seeds = [
            b"vault_period".as_ref(),
            vault.key().as_ref(),
            last_vault_period.period_id.to_string().as_bytes()
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
            vault.key().as_ref(),
            current_vault_period.period_id.to_string().as_bytes()
        ],
        bump = current_vault_period.bump,
        constraint = current_vault_period.period_id == vault.last_drip_period.checked_add(1).unwrap(),
        constraint = current_vault_period.vault == vault.key()
    )]
    pub current_vault_period: Box<Account<'info, VaultPeriod>>,

    #[account(
        // mut needed for CPI
        mut,
        constraint = swap_token_mint.mint_authority.contains(&swap_authority.key()),
        constraint = swap_token_mint.is_initialized
    )]
    pub swap_token_mint: Box<Account<'info, Mint>>,

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
        constraint = vault_token_a_account.mint == token_a_mint.key() @ErrorCode::InvalidMint,
        constraint = vault_token_a_account.owner == vault.key(),
        constraint = vault_token_a_account.amount >= vault.drip_amount
    )]
    pub vault_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = vault_token_b_account.mint == token_b_mint.key() @ErrorCode::InvalidMint,
        constraint = vault_token_b_account.owner == vault.key(),
    )]
    pub vault_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = swap_token_a_account.mint == vault.token_a_mint @ErrorCode::InvalidMint,
        constraint = swap_token_a_account.owner == swap_authority.key()
    )]
    pub swap_token_a_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = swap_token_b_account.mint == vault.token_b_mint @ErrorCode::InvalidMint,
        constraint = swap_token_b_account.owner == swap_authority.key()
    )]
    pub swap_token_b_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = swap_fee_account.mint == swap_token_mint.key()
    )]
    pub swap_fee_account: Box<Account<'info, TokenAccount>>,

    #[account(
        // mut needed because we are changing balance
        mut,
        constraint = drip_fee_token_a_account.mint == token_a_mint.key() @ErrorCode::InvalidMint,
    )]
    pub drip_fee_token_a_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: Checked by token-swap program
    pub swap: UncheckedAccount<'info>,

    /// CHECK: Checked by token-swap program
    pub swap_authority: UncheckedAccount<'info>,

    pub token_swap_program: Program<'info, TokenSwap>,

    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<DripSPLTokenSwap>) -> Result<()> {
    /* MANUAL CHECKS + COMPUTE (CHECKS) */
    if ctx.accounts.vault_token_a_account.amount == 0 || ctx.accounts.vault.drip_amount == 0 {
        return Err(ErrorCode::PeriodicDripAmountIsZero.into());
    }

    if ctx.accounts.vault.limit_swaps
        && !ctx
            .accounts
            .vault
            .whitelisted_swaps
            .contains(ctx.accounts.swap.key)
    {
        return Err(ErrorCode::InvalidSwapAccount.into());
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

    // Use drip_amount because it may change after process_drip
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

    ctx.accounts.vault.process_drip(
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
    swap_tokens(
        &ctx.accounts.token_program,
        &ctx.accounts.token_swap_program,
        &ctx.accounts.vault,
        &ctx.accounts.vault_token_a_account,
        &ctx.accounts.vault_token_b_account,
        &ctx.accounts.swap_authority,
        &ctx.accounts.swap,
        &ctx.accounts.swap_token_a_account,
        &ctx.accounts.swap_token_b_account,
        &ctx.accounts.swap_token_mint,
        &ctx.accounts.swap_fee_account,
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

    let received_b = new_balance_b.checked_sub(current_balance_b).unwrap();
    let swapped_a = current_balance_a.checked_sub(new_balance_a).unwrap();

    // For some reason swap did not happen ~ because we will never have swap amount of 0.
    if received_b == 0 {
        return Err(ErrorCode::IncompleteSwapError.into());
    }

    if swapped_a > current_drip_amount {
        return Err(ErrorCode::SwappedMoreThanVaultDripAmount.into());
    }

    let current_period_mut = &mut ctx.accounts.current_vault_period;
    current_period_mut.update_twap(&ctx.accounts.last_vault_period, swap_amount, received_b);
    current_period_mut.update_drip_timestamp();

    Ok(())
}

/*
    Invokes CPI to SPL's Token Swap
    swap ix requires lot other authority accounts for verification; add them later
*/
fn swap_tokens<'info>(
    token_program: &Program<'info, Token>,
    token_swap_program: &Program<'info, TokenSwap>,
    vault: &Account<'info, Vault>,
    vault_token_a_account: &Account<'info, TokenAccount>,
    vault_token_b_account: &Account<'info, TokenAccount>,
    swap_authority_account_info: &AccountInfo<'info>,
    swap_account_info: &AccountInfo<'info>,
    swap_token_a_account: &Account<'info, TokenAccount>,
    swap_token_b_account: &Account<'info, TokenAccount>,
    swap_token_mint: &Account<'info, Mint>,
    swap_fee_account: &Account<'info, TokenAccount>,
    swap_amount: u64,
) -> Result<()> {
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
        &token_swap_program.key(),
        &token_program.key(),
        &swap_account_info.key(),
        &swap_authority_account_info.key(),
        &vault.key(),
        &vault_token_a_account.key(),
        &swap_token_a_account.key(),
        &swap_token_b_account.key(),
        &vault_token_b_account.key(),
        &swap_token_mint.key(),
        &swap_fee_account.key(),
        None,
        spl_token_swap::instruction::Swap {
            amount_in: swap_amount,
            minimum_amount_out: min_amount_out,
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
            swap_account_info.clone(),
            swap_authority_account_info.clone(),
            vault.to_account_info().clone(),
            vault_token_a_account.to_account_info().clone(),
            swap_token_a_account.to_account_info().clone(),
            swap_token_b_account.to_account_info().clone(),
            vault_token_b_account.to_account_info().clone(),
            swap_token_mint.to_account_info().clone(),
            swap_fee_account.to_account_info().clone(),
            token_program.to_account_info().clone(),
        ],
        &[sign!(vault)],
    )?;

    msg!("completed swap");

    Ok(())
}

// TODO (matcha) Do the math
fn get_minimum_out(_amount_in: u64) -> u64 {
    1 // fake value for now
}
