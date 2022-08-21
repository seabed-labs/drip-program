use crate::errors::ErrorCode;
use crate::interactions::token::{burn_tokens, TransferToken};
use crate::math::{
    calculate_spread_amount, calculate_withdraw_token_a_amount, calculate_withdraw_token_b_amount,
};
use crate::state::{Position, Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_lang::prelude::{Account, Program};
use anchor_spl::token::{Mint, Token, TokenAccount};

pub struct ClosePositionAccounts<'info, 'withdraw> {
    pub vault_period_user_expiry: &'withdraw mut Account<'info, VaultPeriod>,
    pub vault_token_a_account: &'withdraw Account<'info, TokenAccount>,
    pub user_token_a_account: &'withdraw Account<'info, TokenAccount>,
    pub user_position_nft_mint: &'withdraw Account<'info, Mint>,
}

pub fn handle_withdraw<'info, 'withdraw>(
    // Accounts
    vault: &mut Account<'info, Vault>,
    vault_proto_config: &Account<'info, VaultProtoConfig>,
    vault_period_i: &Account<'info, VaultPeriod>,
    vault_period_j: &Account<'info, VaultPeriod>,
    user_position: &mut Account<'info, Position>,
    user_position_nft_account: &Account<'info, TokenAccount>,
    vault_token_b_account: &Account<'info, TokenAccount>,
    vault_treasury_token_b_account: &Account<'info, TokenAccount>,
    user_token_b_account: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    mut with_close_position: Option<ClosePositionAccounts<'info, 'withdraw>>,
) -> Result<()> {
    /* MANUAL CHECKS + COMPUTE (CHECKS) */

    // 1. Get withdrawal b and a amounts
    let i = vault_period_i.period_id;
    let j = vault_period_j.period_id;

    // Token A is only transferred with close_position ix
    let withdrawable_amount_a = if with_close_position.is_some() {
        Some(calculate_withdraw_token_a_amount(
            i,
            j,
            user_position.number_of_swaps,
            user_position.periodic_drip_amount,
        ))
    } else {
        None
    };

    let max_withdrawable_amount_b = calculate_withdraw_token_b_amount(
        i,
        j,
        vault_period_i.twap,
        vault_period_j.twap,
        user_position.periodic_drip_amount,
        vault_proto_config.token_a_drip_trigger_spread,
    );
    let withdrawable_amount_b_before_fees =
        user_position.get_withdrawable_amount_with_max(max_withdrawable_amount_b);

    // Account for Withdrawal Spread on Token B
    let withdrawal_spread_amount_b = calculate_spread_amount(
        withdrawable_amount_b_before_fees,
        vault_proto_config.token_b_withdrawal_spread,
    );
    let withdrawable_amount_b = withdrawable_amount_b_before_fees
        .checked_sub(withdrawal_spread_amount_b)
        .unwrap();
    // If we are not closing the position and the withdraw-able amount is 0, there is no point continuing
    if with_close_position.is_none() && withdrawable_amount_b == 0 {
        return Err(ErrorCode::WithdrawableAmountIsZero.into());
    }

    // 2. Transfer tokens (these are lazily executed below)
    let transfer_a_to_user = if let Some((close_position_accounts, withdrawable_amount_a)) =
        with_close_position.as_ref().zip(withdrawable_amount_a)
    {
        if withdrawable_amount_a == 0 {
            None
        } else {
            Some(TransferToken::new(
                token_program,
                close_position_accounts.vault_token_a_account,
                close_position_accounts.user_token_a_account,
                withdrawable_amount_a,
            ))
        }
    } else {
        None
    };

    let transfer_b_to_user = if withdrawable_amount_b == 0 {
        None
    } else {
        Some(TransferToken::new(
            token_program,
            vault_token_b_account,
            user_token_b_account,
            withdrawable_amount_b,
        ))
    };

    let transfer_b_to_treasury = if withdrawal_spread_amount_b == 0 {
        None
    } else {
        Some(TransferToken::new(
            token_program,
            vault_token_b_account,
            vault_treasury_token_b_account,
            withdrawal_spread_amount_b,
        ))
    };

    /* STATE UPDATES (EFFECTS) */

    // 3. Update the user's position state to reflect the newly withdrawn amount
    user_position.increase_withdrawn_amount(withdrawable_amount_b_before_fees);
    // Close position specific state updates
    if let Some(ref mut close_position_accounts) = with_close_position {
        user_position.close();
        // Only reduce drip amount and dar if we haven't done so already
        if vault_period_j.period_id < close_position_accounts.vault_period_user_expiry.period_id {
            vault.decrease_drip_amount(user_position.periodic_drip_amount);
            close_position_accounts
                .vault_period_user_expiry
                .decrease_drip_amount_to_reduce(user_position.periodic_drip_amount);
        }
    }

    /* MANUAL CPI (INTERACTIONS) */

    // 4. Invoke the token transfer IX's
    if let Some(transfer) = transfer_a_to_user {
        transfer.execute(vault)?;
    }
    if let Some(transfer) = transfer_b_to_user {
        transfer.execute(vault)?;
    }
    if let Some(transfer) = transfer_b_to_treasury {
        transfer.execute(vault)?;
    }
    if let Some(ref close_position_accounts) = with_close_position {
        burn_tokens(
            token_program,
            vault,
            close_position_accounts.user_position_nft_mint,
            user_position_nft_account,
            1,
        )?;
    }

    Ok(())
}