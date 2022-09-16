use crate::errors::DripError;
use crate::interactions::create_token_metadata::{get_metadata_url, CreateTokenMetadata};
use crate::interactions::mint_token::MintToken;
use crate::interactions::set_mint_authority::SetMintAuthority;
use crate::interactions::transfer_token::TransferToken;
use crate::math::calculate_periodic_drip_amount;
use crate::state::Vault;
use crate::ProgramError::InvalidArgument;
use crate::{
    instruction_accounts::deposit::{DepositAccounts, DepositParams, DepositWithMetadataAccounts},
    state::traits::{Executable, Validatable},
    CPI,
};
use crate::{validate, DepositCommonAccounts};
use anchor_lang::prelude::*;
use std::collections::BTreeMap;

pub enum Deposit<'a, 'info> {
    WithoutMetadata {
        accounts: &'a mut DepositAccounts<'info>,
        params: DepositParams,
        bumps: BTreeMap<String, u8>,
    },
    WithMetadata {
        accounts: &'a mut DepositWithMetadataAccounts<'info>,
        params: DepositParams,
        bumps: BTreeMap<String, u8>,
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
    fn execute(self) -> Result<()> {
        match self {
            Deposit::WithoutMetadata {
                accounts,
                params,
                bumps,
            } => {
                let create_token_metadata = None::<Box<CreateTokenMetadata>>;
                execute_deposit(&mut accounts.common, params, bumps, create_token_metadata)
            }
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
                );
                execute_deposit(
                    &mut accounts.common,
                    params,
                    bumps,
                    Some(Box::new(create_token_metadata)),
                )
            }
        }
    }
}

fn execute_deposit(
    accounts: &mut DepositCommonAccounts,
    params: DepositParams,
    bumps: BTreeMap<String, u8>,
    create_token_metadata: Option<Box<impl CPI>>,
) -> Result<()> {
    let token_transfer = TransferToken::new(
        &accounts.token_program,
        &accounts.user_token_a_account,
        &accounts.vault_token_a_account,
        &accounts.vault.to_account_info(),
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

    /* STATE UPDATES (EFFECTS) */
    update_state(accounts, params, bumps)?;

    /* MANUAL CPI (INTERACTIONS) */
    let signer: &Vault = accounts.vault.as_ref();
    token_transfer.execute(signer)?;
    mint_position_nft.execute(signer)?;
    if let Some(create_token_metadata) = create_token_metadata {
        create_token_metadata.execute(signer)?;
    }
    revoke_position_nft_auth.execute(signer)?;

    Ok(())
}

fn update_state(
    accounts: &mut DepositCommonAccounts,
    params: DepositParams,
    bumps: BTreeMap<String, u8>,
) -> Result<()> {
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
        bumps.get("user_position"),
    )
}
