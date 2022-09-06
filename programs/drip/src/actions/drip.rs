use anchor_lang::prelude::*;

use crate::errors::DripError::{
    DuplicateDripError, InvalidOwner, InvalidSwapAccount, PeriodicDripAmountIsZero,
};

use crate::errors::DripError;
use crate::interactions::swap_spl_token_swap::SwapSPLTokenSwap;
use crate::interactions::transfer_token::TransferToken;
use crate::math::{calculate_spread_amount, calculate_sqrt_price_limit};
use crate::state::Vault;

use crate::interactions::swap_orca_whirlpool::SwapOrcaWhirlpool;

use crate::{
    instruction_accounts::{DripOrcaWhirlpoolAccounts, DripSPLTokenSwapAccounts},
    state::traits::{Executable, Validatable},
    validate, DripCommonAccounts, CPI,
};

pub enum Drip<'a, 'info> {
    SPLTokenSwap {
        accounts: &'a mut DripSPLTokenSwapAccounts<'info>,
    },
    OrcaWhirlpool {
        accounts: &'a mut DripOrcaWhirlpoolAccounts<'info>,
    },
}

impl<'a, 'info> Validatable for Drip<'a, 'info> {
    fn validate(&self) -> Result<()> {
        match self {
            Drip::SPLTokenSwap { accounts, .. } => {
                validate_common(&accounts.common, &accounts.swap.key())?;
                validate!(
                    accounts.common.swap_token_a_account.owner == accounts.swap_authority.key(),
                    InvalidOwner
                );
                validate!(
                    accounts.common.swap_token_b_account.owner == accounts.swap_authority.key(),
                    InvalidOwner
                );
                Ok(())
            }
            Drip::OrcaWhirlpool { accounts, .. } => {
                validate_common(&accounts.common, &accounts.whirlpool.key())?;
                validate!(
                    accounts.common.swap_token_a_account.owner == accounts.whirlpool.key(),
                    InvalidOwner
                );
                validate!(
                    accounts.common.swap_token_b_account.owner == accounts.whirlpool.key(),
                    InvalidOwner
                );
                Ok(())
            }
        }
    }
}

fn validate_common(accounts: &DripCommonAccounts, swap: &Pubkey) -> Result<()> {
    validate!(
        accounts.vault_token_a_account.amount > 0 && accounts.vault.drip_amount > 0,
        PeriodicDripAmountIsZero
    );
    validate!(accounts.vault.is_drip_activated(), DuplicateDripError);
    validate!(
        !accounts.vault.limit_swaps || accounts.vault.whitelisted_swaps.contains(swap),
        InvalidSwapAccount
    );
    Ok(())
}

impl<'a, 'info> Executable for Drip<'a, 'info> {
    fn execute(self) -> Result<()> {
        match self {
            Drip::SPLTokenSwap { accounts } => drip_spl_token_swap(accounts),
            Drip::OrcaWhirlpool { accounts } => drip_orca_whirlpool(accounts),
        }
    }
}

// TODO: Dedupe
fn drip_spl_token_swap(accounts: &mut DripSPLTokenSwapAccounts) -> Result<()> {
    let current_drip_amount = accounts.common.vault.drip_amount;
    msg!("drip_amount {:?}", current_drip_amount);

    let current_balance_a = accounts.common.vault_token_a_account.amount;
    msg!("current_balance_a {:?}", current_balance_a);

    let current_balance_b = accounts.common.vault_token_b_account.amount;
    msg!("current_balance_b {:?}", current_balance_b);

    let drip_trigger_spread_amount = calculate_spread_amount(
        current_drip_amount,
        accounts
            .common
            .vault_proto_config
            .token_a_drip_trigger_spread,
    );
    let swap_amount = accounts
        .common
        .vault
        .drip_amount
        .checked_sub(drip_trigger_spread_amount)
        .unwrap();

    let drip_trigger_fee_transfer = TransferToken::new(
        &accounts.common.token_program,
        &accounts.common.vault_token_a_account,
        &accounts.common.drip_fee_token_a_account,
        &accounts.common.vault.to_account_info(),
        drip_trigger_spread_amount,
    );

    let swap = SwapSPLTokenSwap::new(
        &accounts.token_swap_program,
        &accounts.common.token_program,
        &accounts.swap,
        &accounts.swap_authority,
        &accounts.common.vault.to_account_info(),
        &accounts.common.vault_token_a_account,
        &accounts.common.swap_token_a_account,
        &accounts.common.swap_token_b_account,
        &accounts.common.vault_token_b_account,
        &accounts.swap_token_mint,
        &accounts.swap_fee_account,
        swap_amount,
        1,
    );

    /* STATE UPDATES (EFFECTS) */
    accounts.common.vault.process_drip(
        accounts.common.current_vault_period.as_ref(),
        accounts.common.vault_proto_config.granularity,
    );

    /* MANUAL CPI (INTERACTIONS) */
    let signer: &Vault = &accounts.common.vault;
    drip_trigger_fee_transfer.execute(signer)?;
    swap.execute(signer)?;

    /* POST CPI VERIFICATION */
    accounts.common.vault_token_a_account.reload()?;
    accounts.common.vault_token_b_account.reload()?;

    let new_balance_a = accounts.common.vault_token_a_account.amount;
    msg!("new_balance_a {:?}", new_balance_a);
    let new_balance_b = accounts.common.vault_token_b_account.amount;
    msg!("new_balance_b {:?}", new_balance_b);
    let received_b = new_balance_b.checked_sub(current_balance_b).unwrap();
    let swapped_a = current_balance_a.checked_sub(new_balance_a).unwrap();

    // For some reason swap did not happen ~ because we will never have swap amount of 0.
    if received_b == 0 {
        return Err(DripError::IncompleteSwapError.into());
    }
    if swapped_a > current_drip_amount {
        return Err(DripError::SwappedMoreThanVaultDripAmount.into());
    }

    /* POST CPI STATE UPDATES (EFFECTS) */
    accounts.common.current_vault_period.update_twap(
        &accounts.common.last_vault_period,
        swap_amount,
        received_b,
    );
    accounts.common.current_vault_period.update_drip_timestamp();
    Ok(())
}

// TODO: dedupe
fn drip_orca_whirlpool(accounts: &mut DripOrcaWhirlpoolAccounts) -> Result<()> {
    let current_drip_amount = accounts.common.vault.drip_amount;
    msg!("drip_amount {:?}", current_drip_amount);

    let current_balance_a = accounts.common.vault_token_a_account.amount;
    msg!("current_balance_a {:?}", current_balance_a);

    let current_balance_b = accounts.common.vault_token_b_account.amount;
    msg!("current_balance_b {:?}", current_balance_b);

    let drip_trigger_spread_amount = calculate_spread_amount(
        current_drip_amount,
        accounts
            .common
            .vault_proto_config
            .token_a_drip_trigger_spread,
    );
    let swap_amount = accounts
        .common
        .vault
        .drip_amount
        .checked_sub(drip_trigger_spread_amount)
        .unwrap();

    let sqrt_price_limit = calculate_sqrt_price_limit(
        accounts.whirlpool.sqrt_price,
        accounts.common.vault.max_slippage_bps,
        accounts.common.vault_token_a_account.mint.key()
            == accounts.common.swap_token_a_account.mint.key(),
    );

    let swap = SwapOrcaWhirlpool::new(
        &accounts.whirlpool_program,
        &accounts.common.token_program,
        &accounts.common.vault.to_account_info(),
        &accounts.whirlpool.to_account_info(),
        &accounts.common.vault_token_a_account,
        &accounts.common.swap_token_a_account,
        &accounts.common.vault_token_b_account,
        &accounts.common.swap_token_b_account,
        &accounts.tick_array_0.to_account_info(),
        &accounts.tick_array_1.to_account_info(),
        &accounts.tick_array_2.to_account_info(),
        &accounts.oracle,
        swap_amount,
        sqrt_price_limit,
    );

    let drip_trigger_fee_transfer = TransferToken::new(
        &accounts.common.token_program,
        &accounts.common.vault_token_a_account,
        &accounts.common.drip_fee_token_a_account,
        &accounts.common.vault.to_account_info(),
        drip_trigger_spread_amount,
    );

    /* STATE UPDATES (EFFECTS) */
    accounts.common.vault.process_drip(
        accounts.common.current_vault_period.as_ref(),
        accounts.common.vault_proto_config.granularity,
    );

    /* MANUAL CPI (INTERACTIONS) */
    let signer: &Vault = &accounts.common.vault;
    drip_trigger_fee_transfer.execute(signer)?;
    swap.execute(signer)?;

    /* POST CPI VERIFICATION */
    accounts.common.vault_token_a_account.reload()?;
    accounts.common.vault_token_b_account.reload()?;

    let new_balance_a = accounts.common.vault_token_a_account.amount;
    msg!("new_balance_a {:?}", new_balance_a);
    let new_balance_b = accounts.common.vault_token_b_account.amount;
    msg!("new_balance_b {:?}", new_balance_b);
    let received_b = new_balance_b.checked_sub(current_balance_b).unwrap();
    let swapped_a = current_balance_a.checked_sub(new_balance_a).unwrap();

    // For some reason swap did not happen ~ because we will never have swap amount of 0.
    if received_b == 0 {
        return Err(DripError::IncompleteSwapError.into());
    }
    if swapped_a > current_drip_amount {
        return Err(DripError::SwappedMoreThanVaultDripAmount.into());
    }

    /* POST CPI STATE UPDATES (EFFECTS) */
    accounts.common.current_vault_period.update_twap(
        &accounts.common.last_vault_period,
        swap_amount,
        received_b,
    );
    accounts.common.current_vault_period.update_drip_timestamp();
    Ok(())
}

// fn execute_drip(accounts: &mut DripCommonAccounts, swap: impl CPI) -> Result<()> {
//     let current_drip_amount = accounts.vault.drip_amount;
//     msg!("drip_amount {:?}", current_drip_amount);
//
//     let current_balance_a = accounts.vault_token_a_account.amount;
//     msg!("current_balance_a {:?}", current_balance_a);
//
//     let current_balance_b = accounts.vault_token_b_account.amount;
//     msg!("current_balance_b {:?}", current_balance_b);
//
//     let drip_trigger_spread_amount = calculate_spread_amount(
//         accounts.vault.drip_amount,
//         accounts.vault_proto_config.token_a_drip_trigger_spread,
//     );
//     let swap_amount = accounts
//         .vault
//         .drip_amount
//         .checked_sub(drip_trigger_spread_amount)
//         .unwrap();
//
//     let drip_trigger_fee_transfer = TransferToken::new(
//         &accounts.token_program,
//         &accounts.vault_token_a_account,
//         &accounts.drip_fee_token_a_account,
//         &accounts.vault.to_account_info(),
//         drip_trigger_spread_amount,
//     );
//
//     /* STATE UPDATES (EFFECTS) */
//     accounts.vault.process_drip(
//         accounts.current_vault_period.as_ref(),
//         accounts.vault_proto_config.granularity,
//     );
//
//     /* MANUAL CPI (INTERACTIONS) */
//     let signer: &Vault = &accounts.vault;
//     drip_trigger_fee_transfer.execute(signer)?;
//     swap.execute(signer)?;
//
//     /* POST CPI VERIFICATION */
//     accounts.vault_token_a_account.reload()?;
//     accounts.vault_token_b_account.reload()?;
//
//     let new_balance_a = accounts.vault_token_a_account.amount;
//     msg!("new_balance_a {:?}", new_balance_a);
//     let new_balance_b = accounts.vault_token_b_account.amount;
//     msg!("new_balance_b {:?}", new_balance_b);
//     let received_b = new_balance_b.checked_sub(current_balance_b).unwrap();
//     let swapped_a = current_balance_a.checked_sub(new_balance_a).unwrap();
//
//     // For some reason swap did not happen ~ because we will never have swap amount of 0.
//     if received_b == 0 {
//         return Err(DripError::IncompleteSwapError.into());
//     }
//     if swapped_a > current_drip_amount {
//         return Err(DripError::SwappedMoreThanVaultDripAmount.into());
//     }
//     /* POST CPI STATE UPDATES (EFFECTS) */
//     // TODO: this price calc is exceeding our stack limit :(
//     let price = compute_price(received_b, swap_amount);
//     let new_twap = calculate_new_twap_amount(
//         accounts.last_vault_period.twap,
//         accounts.current_vault_period.period_id,
//         price,
//     );
//     accounts.current_vault_period.update_twap(new_twap);
//     accounts.current_vault_period.update_drip_timestamp();
//     Ok(())
// }
