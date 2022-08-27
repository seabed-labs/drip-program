use crate::errors::ErrorCode;
use crate::interactions::transfer_token::TransferToken;
use crate::math::{calculate_spread_amount, calculate_sqrt_price_limit};
use crate::state::traits::CPI;
use crate::state::traits::PDA;
use crate::state::vault::Vault;
use crate::state::{VaultPeriod, VaultProtoConfig};
use crate::{sign, TokenSwap, WhirlpoolProgram};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::{Mint, Token, TokenAccount};
use borsh::BorshSerialize;
use whirlpool::state::Whirlpool;

pub struct OrcaWhirlpoolAccounts<'info, 'drip> {
    pub whirlpool: &'drip Account<'info, Whirlpool>,
    pub tick_array_0: &'drip UncheckedAccount<'info>,
    pub tick_array_1: &'drip UncheckedAccount<'info>,
    pub tick_array_2: &'drip UncheckedAccount<'info>,
    pub oracle: &'drip UncheckedAccount<'info>,
    pub whirlpool_program: &'drip Program<'info, WhirlpoolProgram>,
}

pub struct SPLTokenSwapAccounts<'info, 'drip> {
    pub swap: &'drip UncheckedAccount<'info>,
    pub swap_token_mint: &'drip Account<'info, Mint>,
    pub swap_fee_account: &'drip Account<'info, TokenAccount>,
    pub swap_authority: &'drip UncheckedAccount<'info>,
    pub token_swap_program: &'drip Program<'info, TokenSwap>,
}

pub fn handle_drip<'info, 'drip>(
    // Accounts
    vault: &mut Account<'info, Vault>,
    vault_proto_config: &Account<'info, VaultProtoConfig>,
    vault_token_a_account: &mut Account<'info, TokenAccount>,
    vault_token_b_account: &mut Account<'info, TokenAccount>,
    drip_fee_token_a_account: &mut Account<'info, TokenAccount>,
    last_vault_period: &Account<'info, VaultPeriod>,
    current_vault_period: &mut Account<'info, VaultPeriod>,
    swap_token_a_account: &mut Account<'info, TokenAccount>,
    swap_token_b_account: &mut Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    with_spl_token_swap: Option<SPLTokenSwapAccounts<'info, 'drip>>,
    with_orca_whirlpool: Option<OrcaWhirlpoolAccounts<'info, 'drip>>,
) -> Result<()> {
    /* MANUAL CHECKS + COMPUTE (CHECKS) */
    if vault_token_a_account.amount == 0 || vault.drip_amount == 0 {
        return Err(ErrorCode::PeriodicDripAmountIsZero.into());
    }
    let pubkey_for_whitelist = if let Some(ref params) = with_spl_token_swap {
        *params.swap.key
    } else if let Some(ref params) = with_orca_whirlpool {
        params.whirlpool.key()
    } else {
        panic!("un-reachable code path, whitelist check")
    };
    if vault.limit_swaps && !vault.whitelisted_swaps.contains(&pubkey_for_whitelist) {
        return Err(ErrorCode::InvalidSwapAccount.into());
    }

    if !vault.is_drip_activated() {
        return Err(ErrorCode::DuplicateDripError.into());
    }

    /* STATE UPDATES (EFFECTS) */
    let current_drip_amount = vault.drip_amount;
    msg!("drip_amount {:?}", current_drip_amount);

    let current_balance_a = vault_token_a_account.amount;
    msg!("current_balance_a {:?}", current_balance_a);

    let current_balance_b = vault_token_b_account.amount;
    msg!("current_balance_b {:?}", current_balance_b);

    // Use drip_amount because it may change after process_drip
    let drip_trigger_spread_amount = calculate_spread_amount(
        current_drip_amount,
        vault_proto_config.token_a_drip_trigger_spread,
    );

    let swap_amount = vault
        .drip_amount
        .checked_sub(drip_trigger_spread_amount)
        .unwrap();

    vault.process_drip(current_vault_period, vault_proto_config.granularity);

    let drip_trigger_fee_transfer = TransferToken::new(
        token_program,
        vault_token_a_account,
        drip_fee_token_a_account,
        &vault.to_account_info(),
        drip_trigger_spread_amount,
    );

    /* MANUAL CPI (INTERACTIONS) */
    if let Some(ref params) = with_spl_token_swap {
        spl_token_swap_swap_tokens(
            token_program,
            params.token_swap_program,
            vault,
            vault_token_a_account,
            vault_token_b_account,
            params.swap_authority,
            params.swap,
            swap_token_a_account,
            swap_token_b_account,
            params.swap_token_mint,
            params.swap_fee_account,
            swap_amount,
        )?;
    } else if let Some(ref params) = with_orca_whirlpool {
        orca_whirlpool_swap_tokens(
            vault,
            vault_token_a_account,
            vault_token_b_account,
            token_program,
            params.whirlpool_program,
            params.whirlpool,
            swap_token_a_account,
            swap_token_b_account,
            params.tick_array_0,
            params.tick_array_1,
            params.tick_array_2,
            params.oracle,
            swap_amount,
        )?;
    } else {
        panic!("un-reachable code path, swap tokens")
    }

    let signer: &Vault = vault.as_ref();
    drip_trigger_fee_transfer.execute(signer)?;

    drip_fee_token_a_account.reload()?;
    vault_token_a_account.reload()?;
    vault_token_b_account.reload()?;

    let new_drip_trigger_fee_balance_a = drip_fee_token_a_account.amount;
    msg!(
        "new_drip_trigger_fee_balance_a {:?}",
        new_drip_trigger_fee_balance_a
    );

    let new_balance_a = vault_token_a_account.amount;
    msg!("new_balance_a {:?}", new_balance_a);

    let new_balance_b = vault_token_b_account.amount;
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

    current_vault_period.update_twap(last_vault_period, swap_amount, received_b);
    current_vault_period.update_drip_timestamp();

    Ok(())
}

/*
    Invokes CPI to SPL's Token Swap
    swap ix requires lot other authority accounts for verification; add them later
*/
fn spl_token_swap_swap_tokens<'info>(
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
    let min_amount_out = spl_token_swap_get_minimum_out(swap_amount);

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

    invoke_signed(
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

fn spl_token_swap_get_minimum_out(_amount_in: u64) -> u64 {
    // TODO (matcha) Do the math
    // TODO(matcha) Move this to the math lib
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
    1 // fake value for now
}

#[derive(BorshSerialize)]
pub struct WhirlpoolSwapParams {
    amount: u64,
    other_amount_threshold: u64,
    sqrt_price_limit: u128,
    amount_specified_is_input: bool,
    a_to_b: bool, // Zero for one
}

fn orca_whirlpool_swap_tokens<'info>(
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
    let a_to_b = vault_token_a_account.mint.key() == whirlpool_token_vault_a.mint.key();
    msg!("a_to_b: {:?}", a_to_b);

    let sqrt_price_limit =
        calculate_sqrt_price_limit(whirlpool.sqrt_price, vault.max_slippage_bps, a_to_b);
    let params = WhirlpoolSwapParams {
        amount: swap_amount,
        other_amount_threshold: 1,
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

    let ix = Instruction {
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

    invoke_signed(
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
