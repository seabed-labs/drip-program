use crate::state::traits::{Executable, Validatable};
use crate::{validate, ClosePositionAccounts, WithdrawBAccounts, WithdrawCommonAccounts, CPI};
use std::cmp::min;

use crate::errors::DripError;
use crate::interactions::burn_token::BurnToken;
use crate::interactions::transfer_token::TransferToken;
use crate::math::{
    calculate_spread_amount, calculate_withdraw_token_a_amount, calculate_withdraw_token_b_amount,
};
use crate::state::Vault;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

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
                validate_common(&accounts.common)?;
                let WithdrawalAmountB {
                    withdrawable_amount_b_before_fees: _,
                    treasury_spread_amount_b: _,
                    referrer_spread_amount_b: _,
                    withdrawable_amount_b,
                } = get_withdrawal_amount_b(&accounts.common);
                if withdrawable_amount_b == 0 {
                    return Err(DripError::WithdrawableAmountIsZero.into());
                }
                Ok(())
            }
            Withdraw::WithClosePosition { accounts } => {
                validate_common(&accounts.common)?;
                // Relation Checks
                validate!(
                    accounts.vault_period_user_expiry.vault == accounts.common.vault.key(),
                    DripError::InvalidVaultReference
                );
                validate!(
                    accounts.vault_token_a_account.key() == accounts.common.vault.token_a_account,
                    DripError::IncorrectVaultTokenAccount
                );
                validate!(
                    accounts.user_position_nft_mint.key()
                        == accounts.common.user_position.position_authority,
                    DripError::InvalidMint
                );
                // Intentionally not added these checks, we don't need them
                // validate!(
                //     accounts.user_token_a_account.owner == accounts.common.withdrawer.key(),
                //     DripError::InvalidOwner
                // );
                // validate!(
                //     accounts.user_token_a_account.mint == accounts.common.vault.token_a_mint,
                //     DripError::InvalidMint
                // );

                // Business Checks
                validate!(
                    accounts.user_position_nft_mint.supply == 1
                        && accounts.user_position_nft_mint.decimals == 0
                        && accounts.user_position_nft_mint.is_initialized
                        && accounts.user_position_nft_mint.mint_authority.is_none()
                        && accounts.user_position_nft_mint.freeze_authority.is_none(),
                    DripError::InvalidMint
                );
                validate!(
                    accounts.vault_period_user_expiry.period_id
                        == accounts
                            .common
                            .user_position
                            .drip_period_id_before_deposit
                            .checked_add(accounts.common.user_position.number_of_swaps)
                            .unwrap(),
                    DripError::InvalidVaultPeriod
                );
                Ok(())
            }
        }
    }
}

fn validate_common(accounts: &WithdrawCommonAccounts) -> Result<()> {
    // Relation Checks
    validate!(
        accounts.vault_proto_config.key() == accounts.vault.proto_config,
        DripError::InvalidVaultProtoConfigReference
    );

    validate!(
        accounts.vault_period_i.vault == accounts.vault.key(),
        DripError::InvalidVaultReference
    );
    validate!(
        accounts.vault_period_i.period_id == accounts.user_position.drip_period_id_before_deposit,
        DripError::InvalidVaultPeriod
    );

    validate!(
        accounts.vault_period_j.vault == accounts.vault.key(),
        DripError::InvalidVaultReference
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
        accounts.user_position.vault == accounts.vault.key(),
        DripError::InvalidVaultReference
    );
    validate!(
        !accounts.user_position.is_closed,
        DripError::PositionAlreadyClosed
    );
    validate!(
        accounts.user_position.referrer == accounts.referrer.key(),
        DripError::InvalidMint
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
        accounts.user_position_nft_account.amount == 1,
        DripError::PositionBalanceIsZero
    );
    Ok(())
}

impl<'a, 'info> Executable for Withdraw<'a, 'info> {
    fn execute(self) -> Result<()> {
        match self {
            Withdraw::WithoutClosePosition { accounts } => execute_withdraw_b(&mut accounts.common),
            Withdraw::WithClosePosition { accounts } => {
                // withdrawB's execute is a subset of close position (they have slightly different validation)
                execute_withdraw_b(&mut accounts.common)?;

                /* COMPUTE (CHECKS) */
                let withdrawable_amount_a = get_withdrawal_amount_a(&accounts.common);

                let transfer_a_to_user = if withdrawable_amount_a != 0 {
                    Some(TransferToken::new(
                        &accounts.common.token_program,
                        &accounts.vault_token_a_account,
                        &accounts.user_token_a_account,
                        &accounts.common.vault.to_account_info(),
                        withdrawable_amount_a,
                    ))
                } else {
                    None
                };

                let burn_position = BurnToken::new(
                    &accounts.common.token_program,
                    &accounts.user_position_nft_mint,
                    &accounts.common.user_position_nft_account,
                    &accounts.common.vault.to_account_info(),
                    1,
                );

                /* STATE UPDATES (EFFECTS) */
                // Update the user's position state to reflect the newly withdrawn amount
                accounts.common.user_position.close();
                // Only reduce drip amount and dar if we haven't done so already
                if accounts.common.vault_period_j.period_id
                    < accounts.vault_period_user_expiry.period_id
                {
                    accounts
                        .common
                        .vault
                        .decrease_drip_amount(accounts.common.user_position.periodic_drip_amount);
                    accounts
                        .vault_period_user_expiry
                        .decrease_drip_amount_to_reduce(
                            accounts.common.user_position.periodic_drip_amount,
                        );
                }

                /* MANUAL CPI (INTERACTIONS) */
                let signer: &Vault = &accounts.common.vault;
                if let Some(transfer) = transfer_a_to_user {
                    transfer.execute(signer)?;
                }
                burn_position.execute(signer)?;

                Ok(())
            }
        }
    }
}

fn execute_withdraw_b(accounts: &mut WithdrawCommonAccounts) -> Result<()> {
    /* COMPUTE (CHECKS) */
    let WithdrawalAmountB {
        withdrawable_amount_b_before_fees,
        treasury_spread_amount_b,
        referrer_spread_amount_b,
        withdrawable_amount_b,
    } = get_withdrawal_amount_b(accounts);
    // If for some rounding reason we have 0 zero spread, don't error out
    let transfer_b_to_treasury = if treasury_spread_amount_b != 0 {
        Some(TransferToken::new(
            &accounts.token_program,
            &accounts.vault_token_b_account,
            &accounts.vault_treasury_token_b_account,
            &accounts.vault.to_account_info(),
            treasury_spread_amount_b,
        ))
    } else {
        None
    };
    let transfer_b_to_referrer =
        if accounts.user_position.is_referred && referrer_spread_amount_b != 0 {
            let referrer = Account::<'_, TokenAccount>::try_from(&accounts.referrer)?;
            Some(TransferToken::new(
                &accounts.token_program,
                &accounts.vault_token_b_account,
                &referrer,
                &accounts.vault.to_account_info(),
                referrer_spread_amount_b,
            ))
        } else {
            None
        };
    let transfer_b_to_user = if withdrawable_amount_b != 0 {
        Some(TransferToken::new(
            &accounts.token_program,
            &accounts.vault_token_b_account,
            &accounts.user_token_b_account,
            &accounts.vault.to_account_info(),
            withdrawable_amount_b,
        ))
    } else {
        None
    };

    /* STATE UPDATES (EFFECTS) */
    // Update the user's position state to reflect the newly withdrawn amount
    accounts
        .user_position
        .increase_withdrawn_amount(withdrawable_amount_b_before_fees);

    /* MANUAL CPI (INTERACTIONS) */
    let signer: &Vault = &accounts.vault;
    if let Some(transfer) = transfer_b_to_treasury {
        transfer.execute(signer)?;
    }
    if let Some(transfer) = transfer_b_to_user {
        transfer.execute(signer)?;
    }
    if let Some(transfer) = transfer_b_to_referrer {
        transfer.execute(signer)?;
    }
    Ok(())
}

struct WithdrawalAmountB {
    pub withdrawable_amount_b_before_fees: u64,
    pub treasury_spread_amount_b: u64,
    pub referrer_spread_amount_b: u64,
    pub withdrawable_amount_b: u64,
}

fn get_withdrawal_amount_b(accounts: &WithdrawCommonAccounts) -> WithdrawalAmountB {
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
    let treasury_spread_amount_b = calculate_spread_amount(
        withdrawable_amount_b_before_fees,
        accounts.vault_proto_config.token_b_withdrawal_spread,
    );
    let referrer_spread_amount_b = if accounts.user_position.is_referred {
        calculate_spread_amount(
            withdrawable_amount_b_before_fees,
            accounts.vault_proto_config.token_b_referral_spread,
        )
    } else {
        0
    };

    let withdrawable_amount_b = withdrawable_amount_b_before_fees
        .checked_sub(treasury_spread_amount_b)
        .unwrap()
        .checked_sub(referrer_spread_amount_b)
        .unwrap();

    WithdrawalAmountB {
        withdrawable_amount_b_before_fees,
        treasury_spread_amount_b,
        referrer_spread_amount_b,
        withdrawable_amount_b,
    }
}

fn get_withdrawal_amount_a(accounts: &WithdrawCommonAccounts) -> u64 {
    let i = accounts.vault_period_i.period_id;
    let j = accounts.vault_period_j.period_id;

    calculate_withdraw_token_a_amount(
        i,
        j,
        accounts.user_position.number_of_swaps,
        accounts.user_position.periodic_drip_amount,
    )
}
