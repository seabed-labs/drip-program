use crate::errors::DripError;
use crate::interactions::mint_token::MintToken;
use crate::interactions::set_mint_authority::SetMintAuthority;
use crate::interactions::transfer_token::TransferToken;
use crate::math::calculate_periodic_drip_amount;
use crate::state::Vault;
use crate::ProgramError::{IllegalOwner, InvalidArgument};
use crate::{
    instruction_accounts::deposit::{DepositAccounts, DepositParams, DepositWithMetadataAccounts},
    state::traits::{Executable, Validatable},
    CPI,
};

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
            } => {
                // Relation Checks
                if accounts.vault_period_end.vault != accounts.vault.key() {
                    return Err(DripError::InvalidVaultReference.into());
                }
                if accounts.vault_token_a_account.mint != accounts.vault.token_a_mint {
                    return Err(DripError::InvalidMint.into());
                }
                if accounts.vault_token_a_account.owner != accounts.vault.key() {
                    return Err(IllegalOwner.into());
                }
                // TODO(Mocha): we likely don't need all these user account checks
                if accounts.user_token_a_account.mint != accounts.vault.token_a_mint {
                    return Err(DripError::InvalidMint.into());
                }
                if accounts.user_token_a_account.owner != accounts.depositor.key() {
                    return Err(IllegalOwner.into());
                }
                if !accounts
                    .user_token_a_account
                    .delegate
                    .contains(&accounts.vault.key())
                {
                    return Err(IllegalOwner.into());
                }
                // Business Checks
                if params.number_of_swaps == 0 {
                    return Err(DripError::NumSwapsIsZero.into());
                }
                if accounts.vault_period_end.period_id == 0 {
                    return Err(DripError::InvalidVaultPeriod.into());
                }
                if accounts.vault_period_end.period_id
                    != accounts
                        .vault
                        .last_drip_period
                        .checked_add(params.number_of_swaps)
                        .unwrap()
                {
                    return Err(DripError::InvalidVaultPeriod.into());
                }
                if params.token_a_deposit_amount == 0 {
                    return Err(InvalidArgument.into());
                }
                // TODO(Mocha): we probably shouldn't throw an error here
                if accounts.user_token_a_account.delegated_amount < params.token_a_deposit_amount {
                    return Err(InvalidArgument.into());
                }
                if calculate_periodic_drip_amount(
                    params.token_a_deposit_amount,
                    params.number_of_swaps,
                ) == 0
                {
                    return Err(DripError::PeriodicDripAmountIsZero.into());
                }
                Ok(())
            }
            Deposit::WithMetadata { .. } => todo!(),
        }
    }
}

impl<'a, 'info> Executable for Deposit<'a, 'info> {
    fn execute(self) -> Result<()> {
        match self {
            Deposit::WithoutMetadata {
                accounts,
                params,
                bumps,
            } => deposit_without_metadata(accounts, params, bumps),
            Deposit::WithMetadata {
                accounts, params, ..
            } => deposit_with_metadata(accounts, params),
        }
    }
}

// At this point, we can have them take whatever code path needed and can arbitrarily share code paths between multiple flows of the same action
// Think of an action as a higher level construct that encompasses all instruction variants

fn deposit_without_metadata(
    accounts: &mut DepositAccounts,
    params: DepositParams,
    bumps: BTreeMap<String, u8>,
) -> Result<()> {
    let token_transfer = TransferToken::new(
        &accounts.token_program,
        &accounts.user_token_a_account,
        &accounts.vault_token_a_account,
        accounts.vault.as_ref().as_ref(),
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
    let periodic_drip_amount =
        calculate_periodic_drip_amount(params.token_a_deposit_amount, params.number_of_swaps);

    accounts.vault.increase_drip_amount(periodic_drip_amount);
    accounts
        .vault_period_end
        .increase_drip_amount_to_reduce(periodic_drip_amount);
    accounts.user_position.init(
        accounts.vault.key(),
        accounts.user_position_nft_mint.key(),
        params.token_a_deposit_amount,
        accounts.vault.last_drip_period,
        params.number_of_swaps,
        periodic_drip_amount,
        bumps.get("user_position"),
    )?;

    /* MANUAL CPI (INTERACTIONS) */
    // TODO(Mocha): should the signer just be part of the ::new fn?
    let signer: &Vault = accounts.vault.as_ref();
    token_transfer.execute(signer)?;
    mint_position_nft.execute(signer)?;
    revoke_position_nft_auth.execute(signer)?;
    Ok(())
}

fn deposit_with_metadata(
    _accounts: &mut DepositWithMetadataAccounts,
    _params: DepositParams,
) -> Result<()> {
    todo!()
}
