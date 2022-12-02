use anchor_lang::prelude::*;

use crate::errors::DripError::{
    DuplicateDripError, IncorrectVaultTokenAccount, InvalidSwapAccount, InvalidVaultPeriod,
    InvalidVaultProtoConfigReference, InvalidVaultReference, PeriodicDripAmountIsZero,
    V1DripOracleNotSupported, V2DripInvalidOracleAccount,
};

use crate::errors::DripError;
use crate::interactions::executor::CpiExecutor;
use crate::interactions::swap_spl_token_swap::SwapSPLTokenSwap;
use crate::interactions::transfer_token::TransferToken;
use crate::math::{
    calculate_spread_amount, calculate_sqrt_price_limit, compute_price_difference, compute_ui_price,
};
use crate::state::{get_oracle_price, Vault};

use crate::interactions::swap_orca_whirlpool::SwapOrcaWhirlpool;

use crate::instruction_accounts::{DripOracleAccounts, DripV2OrcaWhirlpoolAccounts};
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
    V2OrcaWhirlpool {
        accounts: &'a mut DripV2OrcaWhirlpoolAccounts<'info>,
    },
}

impl<'a, 'info> Validatable for Drip<'a, 'info> {
    fn validate(&self) -> Result<()> {
        match self {
            Drip::SPLTokenSwap { accounts, .. } => {
                validate_drip_v1(&accounts.common, &accounts.swap.key())
            }
            Drip::OrcaWhirlpool { accounts, .. } => {
                validate_drip_v1(&accounts.common, &accounts.whirlpool.key())
            }
            Drip::V2OrcaWhirlpool { accounts } => validate_drip_v2(
                &accounts.common,
                &accounts.oracle_common,
                &accounts.whirlpool.key(),
            ),
        }
    }
}
fn validate_drip_v2(
    common_accounts: &DripCommonAccounts,
    oracle_accounts: &DripOracleAccounts,
    swap: &Pubkey,
) -> Result<()> {
    validate!(
        common_accounts.vault.oracle_config == oracle_accounts.oracle_config.key(),
        V2DripInvalidOracleAccount
    );
    validate!(
        common_accounts.vault.token_a_mint == oracle_accounts.oracle_config.token_a_mint,
        V2DripInvalidOracleAccount
    );
    validate!(
        oracle_accounts.oracle_config.token_a_mint == oracle_accounts.token_a_mint.key(),
        V2DripInvalidOracleAccount
    );
    validate!(
        common_accounts.vault.token_b_mint == oracle_accounts.oracle_config.token_b_mint,
        V2DripInvalidOracleAccount
    );
    validate!(
        oracle_accounts.oracle_config.token_a_price == oracle_accounts.token_a_price.key(),
        V2DripInvalidOracleAccount
    );
    validate!(
        oracle_accounts.oracle_config.token_b_mint == oracle_accounts.token_b_mint.key(),
        V2DripInvalidOracleAccount
    );
    validate!(
        oracle_accounts.oracle_config.token_b_price == oracle_accounts.token_b_price.key(),
        V2DripInvalidOracleAccount
    );
    validate_common(common_accounts, swap)
}

fn validate_drip_v1(accounts: &DripCommonAccounts, swap: &Pubkey) -> Result<()> {
    validate!(
        accounts.vault.oracle_config == Pubkey::default(),
        V1DripOracleNotSupported
    );
    validate_common(accounts, swap)
}

fn validate_common(accounts: &DripCommonAccounts, swap: &Pubkey) -> Result<()> {
    validate!(
        accounts.vault_proto_config.key() == accounts.vault.proto_config,
        InvalidVaultProtoConfigReference
    );

    validate!(
        accounts.last_vault_period.vault == accounts.vault.key(),
        InvalidVaultReference
    );

    validate!(
        accounts.current_vault_period.vault == accounts.vault.key(),
        InvalidVaultReference
    );

    validate!(
        accounts.vault_token_a_account.key() == accounts.vault.token_a_account,
        IncorrectVaultTokenAccount
    );

    validate!(
        accounts.vault_token_b_account.key() == accounts.vault.token_b_account,
        IncorrectVaultTokenAccount
    );

    validate!(
        accounts.last_vault_period.period_id == accounts.vault.last_drip_period,
        InvalidVaultPeriod
    );

    validate!(
        accounts.current_vault_period.period_id
            == accounts.vault.last_drip_period.checked_add(1).unwrap(),
        InvalidVaultPeriod
    );

    validate!(accounts.vault.drip_amount > 0, PeriodicDripAmountIsZero);
    validate!(accounts.vault.is_drip_activated(), DuplicateDripError);
    validate!(
        !accounts.vault.limit_swaps || accounts.vault.whitelisted_swaps.contains(swap),
        InvalidSwapAccount
    );

    Ok(())
}

impl<'a, 'info> Executable for Drip<'a, 'info> {
    fn execute(self, cpi_executor: &mut impl CpiExecutor) -> Result<()> {
        match self {
            Drip::SPLTokenSwap { accounts } => {
                let (swap_amount, _) = get_token_a_swap_and_spread_amount(&accounts.common);
                let (swap_token_a_account, swap_token_b_account) =
                    if accounts.common.vault_token_a_account.mint.key()
                        == accounts.common.swap_token_a_account.mint.key()
                    {
                        (
                            &accounts.common.swap_token_a_account,
                            &accounts.common.swap_token_b_account,
                        )
                    } else {
                        (
                            &accounts.common.swap_token_b_account,
                            &accounts.common.swap_token_a_account,
                        )
                    };

                let swap = SwapSPLTokenSwap::new(
                    &accounts.token_swap_program,
                    &accounts.common.token_program,
                    &accounts.swap,
                    &accounts.swap_authority,
                    &accounts.common.vault.to_account_info(),
                    &accounts.common.vault_token_a_account,
                    swap_token_a_account,
                    swap_token_b_account,
                    &accounts.common.vault_token_b_account,
                    &accounts.swap_token_mint,
                    &accounts.swap_fee_account,
                    swap_amount,
                    1,
                );

                execute_drip(&mut accounts.common, None, &swap, cpi_executor)
            }
            Drip::OrcaWhirlpool { accounts } => {
                let (swap_amount, _) = get_token_a_swap_and_spread_amount(&accounts.common);
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
                    &accounts.tick_array_0,
                    &accounts.tick_array_1,
                    &accounts.tick_array_2,
                    &accounts.oracle,
                    swap_amount,
                    sqrt_price_limit,
                );

                execute_drip(&mut accounts.common, None, &swap, cpi_executor)
            }
            Drip::V2OrcaWhirlpool { accounts } => {
                let (swap_amount, _) = get_token_a_swap_and_spread_amount(&accounts.common);
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
                    &accounts.tick_array_0,
                    &accounts.tick_array_1,
                    &accounts.tick_array_2,
                    &accounts.oracle,
                    swap_amount,
                    sqrt_price_limit,
                );

                execute_drip(
                    &mut accounts.common,
                    Some(&mut accounts.oracle_common),
                    &swap,
                    cpi_executor,
                )
            }
        }
    }
}

fn get_token_a_swap_and_spread_amount(accounts: &DripCommonAccounts) -> (u64, u64) {
    let drip_trigger_spread_amount = calculate_spread_amount(
        accounts.vault.drip_amount,
        accounts.vault_proto_config.token_a_drip_trigger_spread,
    );

    let swap_amount = accounts
        .vault
        .drip_amount
        .checked_sub(drip_trigger_spread_amount)
        .unwrap();

    (swap_amount, drip_trigger_spread_amount)
}

#[inline(never)]
fn execute_drip(
    common_accounts: &mut DripCommonAccounts,
    oracle_accounts: Option<&mut DripOracleAccounts>,
    swap: &dyn CPI,
    cpi_executor: &mut dyn CpiExecutor,
) -> Result<()> {
    let current_drip_amount = common_accounts.vault.drip_amount;
    msg!("drip_amount {:?}", current_drip_amount);

    let current_balance_a = common_accounts.vault_token_a_account.amount;
    msg!("current_balance_a {:?}", current_balance_a);

    let current_balance_b = common_accounts.vault_token_b_account.amount;
    msg!("current_balance_b {:?}", current_balance_b);

    let (swap_amount, drip_trigger_spread_amount) =
        get_token_a_swap_and_spread_amount(common_accounts);

    let drip_trigger_fee_transfer = TransferToken::new(
        &common_accounts.token_program,
        &common_accounts.vault_token_a_account,
        &common_accounts.drip_fee_token_a_account,
        &common_accounts.vault.to_account_info(),
        drip_trigger_spread_amount,
    );

    /* STATE UPDATES (EFFECTS) */
    common_accounts.vault.process_drip(
        &common_accounts.current_vault_period,
        common_accounts.vault_proto_config.granularity,
    );

    /* MANUAL CPI (INTERACTIONS) */
    let signer: &Vault = &common_accounts.vault;

    cpi_executor.execute_all(vec![&Some(&drip_trigger_fee_transfer), &Some(swap)], signer)?;

    /* POST CPI VERIFICATION */
    common_accounts.vault_token_a_account.reload()?;
    common_accounts.vault_token_b_account.reload()?;

    let new_balance_a = common_accounts.vault_token_a_account.amount;
    msg!("new_balance_a {:?}", new_balance_a);
    let new_balance_b = common_accounts.vault_token_b_account.amount;
    msg!("new_balance_b {:?}", new_balance_b);
    let received_b = new_balance_b.checked_sub(current_balance_b).unwrap();
    let used_a = current_balance_a.checked_sub(new_balance_a).unwrap();

    if let Some(oracle_accounts) = oracle_accounts {
        let swap_ui_price = compute_ui_price(
            received_b,
            oracle_accounts.token_b_mint.decimals,
            swap_amount,
            oracle_accounts.token_a_mint.decimals,
        );
        let oracle_ui_price = get_oracle_price(
            oracle_accounts.oracle_config.source,
            &oracle_accounts.token_a_price.to_account_info(),
            &oracle_accounts.token_b_price.to_account_info(),
        )?;
        if compute_price_difference(swap_ui_price, oracle_ui_price)
            > common_accounts.vault.max_slippage_bps as i64
        {
            return Err(DripError::SwapPricePastMaxDeviation.into());
        }
    }
    // For some reason swap did not happen ~ because we will never have swap amount of 0.
    if received_b == 0 {
        return Err(DripError::IncompleteSwapError.into());
    }

    if used_a != (swap_amount + drip_trigger_spread_amount) || used_a != current_drip_amount {
        return Err(DripError::IncorrectSwapAmount.into());
    }

    /* POST CPI STATE UPDATES (EFFECTS) */
    common_accounts.current_vault_period.update_twap(
        &common_accounts.last_vault_period,
        swap_amount,
        received_b,
    );

    common_accounts.current_vault_period.update_drip_timestamp();

    Ok(())
}

#[cfg(test)]
mod tests {
    use anchor_lang::solana_program::program_pack::Pack;
    use anchor_spl::token::{Token, TokenAccount};

    use super::*;
    use crate::{
        interactions::executor::{test::TestCpiExecutor, CpiExecutor},
        state::traits::{CPI, PDA},
    };

    pub struct TestDripCpiExecutor<'info> {
        pub base_cpi_executor: TestCpiExecutor,
        pub drip_common_accounts: DripCommonAccounts<'info>,
        pub token_a_to_send: u64,
        pub token_b_to_receive: u64,
    }

    impl<'info> TestDripCpiExecutor<'info> {
        pub fn set_token_account_balance(
            account: &mut Account<'info, TokenAccount>,
            amount: u64,
        ) -> Result<()> {
            let token_account = spl_token::state::Account {
                mint: account.mint,
                owner: account.owner,
                amount,
                delegate: account.delegate,
                state: account.state,
                is_native: account.is_native,
                delegated_amount: account.delegated_amount,
                close_authority: account.close_authority,
            };

            let mut buff: Vec<u8> = vec![];
            spl_token::state::Account::pack(token_account, &mut buff)?;

            let token_account = TokenAccount::try_deserialize(&mut buff.as_slice())?;

            account.set_inner(token_account);

            account.exit(&Token::id())
        }
    }

    impl<'info> CpiExecutor for TestDripCpiExecutor<'info> {
        fn execute_all(&mut self, cpis: Vec<&Option<&dyn CPI>>, signer: &dyn PDA) -> Result<()> {
            self.base_cpi_executor.execute_all(cpis, signer)?;

            let vault_token_a_balance = self.drip_common_accounts.vault_token_a_account.amount;
            let vault_token_b_balance = self.drip_common_accounts.vault_token_a_account.amount;

            Self::set_token_account_balance(
                &mut self.drip_common_accounts.vault_token_a_account,
                vault_token_a_balance - self.token_a_to_send,
            )?;

            Self::set_token_account_balance(
                &mut self.drip_common_accounts.vault_token_b_account,
                vault_token_b_balance + self.token_b_to_receive,
            )?;

            Ok(())
        }
    }
}
