use crate::errors::DripError;
use crate::instruction_accounts::{DepositAccountsBumps, DepositWithMetadataAccountsBumps};
use crate::interactions::create_token_metadata::CreateTokenMetadata;
use crate::interactions::executor::CpiExecutor;
use crate::interactions::mint_token::MintToken;
use crate::interactions::set_mint_authority::SetMintAuthority;
use crate::interactions::transfer_token::TransferToken;
use crate::math::calculate_periodic_drip_amount;
use crate::state::traits::CPI;
use crate::state::Vault;
use crate::ProgramError::InvalidArgument;
use crate::{
    instruction_accounts::deposit::{DepositAccounts, DepositParams, DepositWithMetadataAccounts},
    state::traits::{Executable, Validatable},
};
use crate::{validate, DepositCommonAccounts};
use anchor_lang::prelude::*;

const DRIP_METADATA_NAME: &str = "Drip Position";
const DRIP_METADATA_SYMBOL: &str = "DP";

pub enum Deposit<'a, 'info> {
    WithoutMetadata {
        accounts: &'a mut DepositAccounts<'info>,
        params: DepositParams,
        bumps: DepositAccountsBumps,
    },
    WithMetadata {
        accounts: &'a mut DepositWithMetadataAccounts<'info>,
        params: DepositParams,
        bumps: DepositWithMetadataAccountsBumps,
    },
}

impl<'a, 'info> Validatable for Deposit<'a, 'info> {
    fn validate(&self) -> Result<()> {
        match self {
            Deposit::WithoutMetadata {
                accounts, params, ..
            } => validate_common(&accounts.common, params),

            Deposit::WithMetadata {
                accounts, params, ..
            } => validate_common(&accounts.common, params),
        }
    }
}

fn validate_common(accounts: &DepositCommonAccounts, params: &DepositParams) -> Result<()> {
    validate!(
        accounts.vault_period_end.vault == accounts.vault.key(),
        DripError::InvalidVaultReference
    );

    validate!(
        accounts.vault_period_end.period_id
            == accounts
                .vault
                .last_drip_period
                .checked_add(params.number_of_swaps)
                .unwrap(),
        DripError::InvalidVaultPeriod
    );

    validate!(
        accounts.vault_token_a_account.key() == accounts.vault.token_a_account,
        DripError::IncorrectVaultTokenAccount
    );

    validate!(
        accounts.referrer.mint == accounts.vault.token_b_mint,
        DripError::InvalidMint
    );

    validate!(params.number_of_swaps > 0, DripError::NumSwapsIsZero);

    validate!(params.token_a_deposit_amount > 0, InvalidArgument);

    validate!(
        calculate_periodic_drip_amount(params.token_a_deposit_amount, params.number_of_swaps) > 0,
        DripError::PeriodicDripAmountIsZero
    );

    Ok(())
}

impl<'a, 'info> Executable for Deposit<'a, 'info> {
    fn execute(self, cpi_executor: &mut impl CpiExecutor) -> Result<()> {
        match self {
            Deposit::WithoutMetadata {
                accounts,
                params,
                bumps,
            } => execute_deposit(
                &mut accounts.common,
                params,
                DepositBumps::WithoutMetadata(bumps),
                None,
                cpi_executor,
            ),
            Deposit::WithMetadata {
                accounts,
                params,
                bumps,
            } => {
                let create_token_metadata = CreateTokenMetadata::new(
                    &accounts.metadata_program,
                    &accounts.common.system_program,
                    &accounts.position_metadata_account,
                    &accounts.common.user_position_nft_mint,
                    &accounts.common.vault.to_account_info(),
                    &accounts.common.depositor.to_account_info(),
                    &accounts.common.rent,
                    get_metadata_url(&accounts.common.user_position_nft_mint.key()),
                    DRIP_METADATA_NAME.to_string(),
                    DRIP_METADATA_SYMBOL.to_string(),
                );

                execute_deposit(
                    &mut accounts.common,
                    params,
                    DepositBumps::WithMetadata(bumps),
                    Some(&create_token_metadata),
                    cpi_executor,
                )
            }
        }
    }
}

enum DepositBumps {
    WithoutMetadata(DepositAccountsBumps),
    WithMetadata(DepositWithMetadataAccountsBumps),
}

fn execute_deposit(
    accounts: &mut DepositCommonAccounts,
    params: DepositParams,
    bumps: DepositBumps,
    create_token_metadata: Option<&dyn CPI>,
    cpi_executor: &mut impl CpiExecutor,
) -> Result<()> {
    let token_transfer = TransferToken::new(
        &accounts.token_program,
        &accounts.user_token_a_account,
        &accounts.vault_token_a_account,
        &accounts.depositor.to_account_info(),
        // &accounts.vault.to_account_info(),
        params.token_a_deposit_amount,
    );

    let mint_position_nft = MintToken::new(
        &accounts.token_program,
        &accounts.user_position_nft_mint,
        &accounts.user_position_nft_account,
        &accounts.vault.to_account_info(),
        1,
    );

    let revoke_position_nft_auth = SetMintAuthority::new(
        &accounts.token_program,
        &accounts.user_position_nft_mint,
        &accounts.vault.to_account_info(),
        None,
    );
    let user_position_bump = match bumps {
        DepositBumps::WithoutMetadata(bumps) => bumps.common.user_position,
        DepositBumps::WithMetadata(bumps) => bumps.common.user_position,
    };
    /* STATE UPDATES (EFFECTS) */
    update_state(accounts, params, user_position_bump);

    /* MANUAL CPI (INTERACTIONS) */

    let signer: &Vault = &accounts.vault;

    cpi_executor.execute_all(
        vec![
            &Some(&token_transfer),
            &Some(&mint_position_nft),
            &create_token_metadata,
            &Some(&revoke_position_nft_auth),
        ],
        signer,
    )?;

    Ok(())
}

fn update_state(
    accounts: &mut DepositCommonAccounts,
    params: DepositParams,
    user_position_bump: u8,
) {
    let periodic_drip_amount =
        calculate_periodic_drip_amount(params.token_a_deposit_amount, params.number_of_swaps);

    accounts.vault.increase_drip_amount(periodic_drip_amount);

    accounts
        .vault_period_end
        .increase_drip_amount_to_reduce(periodic_drip_amount);

    accounts.user_position.init(
        accounts.vault.key(),
        accounts.user_position_nft_mint.key(),
        accounts.referrer.key(),
        params.token_a_deposit_amount,
        accounts.vault.last_drip_period,
        params.number_of_swaps,
        periodic_drip_amount,
        user_position_bump,
    );
}

fn get_metadata_url(position_nft_mint_pubkey: &Pubkey) -> String {
    format!(
        "https://api.drip.dcaf.so/v1/drip/position/{}/metadata",
        position_nft_mint_pubkey
    )
}
