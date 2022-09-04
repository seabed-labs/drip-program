use anchor_lang::prelude::*;

use crate::errors::DripError::{
    DuplicateDripError, InvalidOwner, InvalidSwapAccount, PeriodicDripAmountIsZero,
};

use crate::errors::DripError;
use crate::interactions::swap_spl_token_swap::SwapSPLTokenSwap;
use crate::interactions::transfer_token::TransferToken;
use crate::math::calculate_spread_amount;
use crate::state::Vault;

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
                // TODO: should we rename whirlpool to swap so we can normalize this more?
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

fn drip_spl_token_swap(accounts: &mut DripSPLTokenSwapAccounts) -> Result<()> {
    let current_drip_amount = accounts.common.vault.drip_amount;
    msg!("drip_amount {:?}", current_drip_amount);

    let current_balance_a = accounts.common.vault_token_a_account.amount;
    msg!("current_balance_a {:?}", current_balance_a);

    let current_balance_b = accounts.common.vault_token_b_account.amount;
    msg!("current_balance_b {:?}", current_balance_b);

    // Use drip_amount because it may change after process_drip
    let drip_trigger_spread_amount = calculate_spread_amount(
        accounts.common.vault.drip_amount,
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

    let swap_via_spl_token_swap = SwapSPLTokenSwap::new(
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
    swap_via_spl_token_swap.execute(signer)?;

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

fn drip_orca_whirlpool(_accounts: &mut DripOrcaWhirlpoolAccounts) -> Result<()> {
    todo!()
}
