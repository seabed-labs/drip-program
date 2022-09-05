use crate::state::traits::{Executable, Validatable};
use crate::{validate, ClosePositionAccounts, WithdrawBAccounts, CPI};
use std::cmp::min;

use crate::errors::DripError;
use crate::interactions::transfer_token::TransferToken;
use crate::math::{calculate_spread_amount, calculate_withdraw_token_b_amount};
use crate::state::Vault;
use anchor_lang::prelude::*;

pub enum Withdraw<'a, 'info> {
    WithoutClosePosition {
        accounts: &'a mut WithdrawBAccounts<'info>,
    },
    WithClosePosition {
        accounts: &'a mut ClosePositionAccounts<'info>,
    },
}

impl<'a, 'info> Validatable for Withdraw<'a, 'info> {
    fn validate(&self) -> Result<()> {
        match self {
            Withdraw::WithoutClosePosition { accounts } => {
                validate_common(accounts)?;
                let WithdrawalAmountB {
                    withdrawable_amount_b_before_fees: _withdrawable_amount_b_before_fees,
                    withdrawal_spread_amount_b: _withdrawal_spread_amount_b,
                    withdrawable_amount_b,
                } = get_withdrawal_amount_b(accounts);
                if withdrawable_amount_b == 0 {
                    return Err(DripError::WithdrawableAmountIsZero.into());
                }
                Ok(())
            }
            Withdraw::WithClosePosition { accounts } => validate_common(&accounts.common),
        }
    }
}

fn validate_common(accounts: &WithdrawBAccounts) -> Result<()> {
    validate!(
        accounts.vault_proto_config.key() == accounts.vault.proto_config,
        DripError::InvalidVaultProtoConfigReference
    );
    validate!(
        accounts.vault_period_i.vault == accounts.vault.key(),
        DripError::InvalidVaultReference
    );
    validate!(
        accounts.vault_period_j.vault == accounts.vault.key(),
        DripError::InvalidVaultReference
    );
    validate!(
        accounts.user_position_nft_account.mint == accounts.user_position.position_authority,
        DripError::InvalidMint
    );
    validate!(
        accounts.user_position_nft_account.owner == accounts.withdrawer.key(),
        DripError::InvalidOwner
    );
    validate!(
        accounts.vault_token_b_account.key() == accounts.vault.token_b_account,
        DripError::IncorrectVaultTokenAccount
    );
    validate!(
        accounts.vault_treasury_token_b_account.key() == accounts.vault.treasury_token_b_account,
        DripError::IncorrectVaultTokenAccount
    );
    validate!(
        accounts.user_token_b_account.owner == accounts.withdrawer.key(),
        DripError::InvalidOwner
    );
    validate!(
        accounts.user_token_b_account.mint == accounts.vault_token_b_account.mint,
        DripError::InvalidMint
    );

    validate!(
        accounts.vault_period_i.period_id == accounts.user_position.drip_period_id_before_deposit,
        DripError::InvalidVaultPeriod
    );
    validate!(
        accounts.vault_period_j.period_id
            == min(
                accounts.vault.last_drip_period,
                accounts
                    .user_position
                    .drip_period_id_before_deposit
                    .checked_add(accounts.user_position.number_of_swaps)
                    .unwrap()
            ),
        DripError::InvalidVaultPeriod
    );

    validate!(
        accounts.user_position_nft_account.amount == 1,
        DripError::PositionBalanceIsZero
    );

    Ok(())
}

impl<'a, 'info> Executable for Withdraw<'a, 'info> {
    fn execute(self) -> Result<()> {
        match self {
            Withdraw::WithoutClosePosition { accounts } => {
                /* COMPUTE (CHECKS) */
                let WithdrawalAmountB {
                    withdrawable_amount_b_before_fees,
                    withdrawal_spread_amount_b,
                    withdrawable_amount_b,
                } = get_withdrawal_amount_b(accounts);
                // If for some rounding reason we have 0 zero spread, don't error out
                let transfer_b_to_treasury = if withdrawal_spread_amount_b != 0 {
                    Some(TransferToken::new(
                        &accounts.token_program,
                        &accounts.vault_token_b_account,
                        &accounts.vault_treasury_token_b_account,
                        &accounts.vault.to_account_info(),
                        withdrawal_spread_amount_b,
                    ))
                } else {
                    None
                };
                let transfer_b_to_user = TransferToken::new(
                    &accounts.token_program,
                    &accounts.vault_token_b_account,
                    &accounts.user_token_b_account,
                    &accounts.vault.to_account_info(),
                    withdrawable_amount_b,
                );

                /* STATE UPDATES (EFFECTS) */

                // Update the user's position state to reflect the newly withdrawn amount
                accounts
                    .user_position
                    .increase_withdrawn_amount(withdrawable_amount_b_before_fees);

                let signer: &Vault = &accounts.vault;
                if let Some(transfer) = transfer_b_to_treasury {
                    transfer.execute(signer)?;
                }
                transfer_b_to_user.execute(signer)?;
                Ok(())
            }
            Withdraw::WithClosePosition { .. } => todo!(),
        }
    }
}

struct WithdrawalAmountB {
    pub withdrawable_amount_b_before_fees: u64,
    pub withdrawal_spread_amount_b: u64,
    pub withdrawable_amount_b: u64,
}
fn get_withdrawal_amount_b(accounts: &WithdrawBAccounts) -> WithdrawalAmountB {
    let i = accounts.vault_period_i.period_id;
    let j = accounts.vault_period_j.period_id;
    let max_withdrawable_amount_b = calculate_withdraw_token_b_amount(
        i,
        j,
        accounts.vault_period_i.twap,
        accounts.vault_period_j.twap,
        accounts.user_position.periodic_drip_amount,
        accounts.vault_proto_config.token_a_drip_trigger_spread,
    );
    let withdrawable_amount_b_before_fees = accounts
        .user_position
        .get_withdrawable_amount_with_max(max_withdrawable_amount_b);

    // Account for Withdrawal Spread on Token B
    let withdrawal_spread_amount_b = calculate_spread_amount(
        withdrawable_amount_b_before_fees,
        accounts.vault_proto_config.token_b_withdrawal_spread,
    );
    let withdrawable_amount_b = withdrawable_amount_b_before_fees
        .checked_sub(withdrawal_spread_amount_b)
        .unwrap();
    WithdrawalAmountB {
        withdrawable_amount_b_before_fees,
        withdrawal_spread_amount_b,
        withdrawable_amount_b,
    }
}
