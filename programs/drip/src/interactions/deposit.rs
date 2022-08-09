use crate::sign;
use crate::state::Vault;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token;
use anchor_spl::token::{Mint, MintTo, Token, TokenAccount};
use mpl_token_metadata::instruction::create_metadata_accounts_v3;
use spl_token::instruction::AuthorityType;

const DRIP_METADATA_NAME: &str = "Dcaf Drip Position";
const DRIP_METADATA_SYMBOL: &str = "DDP";
const DRIP_METADATA_URI: &str = "https://api.drip.dcaf.so/v1/drip/positionmetadata";

pub fn mint_position_without_metadata<'info>(
    vault: &Account<'info, Vault>,
    mint: &Account<'info, Mint>,
    to: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
) -> Result<()> {
    mint_position_nft(vault, mint, to, token_program)?;

    revoke_position_nft_auth(token_program, vault, mint)?;

    Ok(())
}

pub fn mint_position_with_metadata<'info>(
    vault: &Account<'info, Vault>,
    mint: &Account<'info, Mint>,
    to: &Account<'info, TokenAccount>,

    position_metadata_account: &UncheckedAccount<'info>,
    funder: &Signer<'info>,
    metadata_program: &UncheckedAccount<'info>,
    token_program: &Program<'info, Token>,
    system_program: &Program<'info, System>,
    rent: &Sysvar<'info, Rent>,
) -> Result<()> {
    mint_position_nft(vault, mint, to, token_program)?;

    invoke_signed(
        &create_metadata_accounts_v3(
            metadata_program.key(),
            position_metadata_account.key(),
            mint.key(),
            vault.key(),
            funder.key(),
            vault.key(),
            DRIP_METADATA_NAME.to_string(),
            DRIP_METADATA_SYMBOL.to_string(),
            DRIP_METADATA_URI.to_string(),
            None,
            0,
            false,
            true,
            None,
            None,
            None,
        ),
        &[
            position_metadata_account.to_account_info(),
            mint.to_account_info(),
            vault.to_account_info(),
            vault.to_account_info(),
            funder.to_account_info(),
            metadata_program.to_account_info(),
            system_program.to_account_info(),
            rent.to_account_info(),
        ],
        &[sign!(vault)],
    )?;

    revoke_position_nft_auth(token_program, vault, mint)?;

    Ok(())
}

fn mint_position_nft<'info>(
    vault: &Account<'info, Vault>,
    mint: &Account<'info, Mint>,
    to: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
) -> Result<()> {
    // Mint NFT to user
    token::mint_to(
        CpiContext::new_with_signer(
            token_program.to_account_info().clone(),
            MintTo {
                mint: mint.to_account_info().clone(),
                to: to.to_account_info().clone(),
                authority: vault.to_account_info().clone(),
            },
            &[sign!(vault)],
        ),
        1,
    )?;

    Ok(())
}

fn revoke_position_nft_auth<'info>(
    token_program: &Program<'info, Token>,
    vault: &Account<'info, Vault>,
    mint: &Account<'info, Mint>,
) -> Result<()> {
    // Set the mint authority for this position NFT mint to None so that new tokens cannot be minted
    invoke_signed(
        &spl_token::instruction::set_authority(
            &token::ID,
            mint.to_account_info().key,
            None,
            AuthorityType::MintTokens,
            vault.to_account_info().key,
            &[vault.to_account_info().key],
        )?,
        &[
            mint.to_account_info().clone(),
            vault.to_account_info().clone(),
            token_program.to_account_info().clone(),
        ],
        &[sign!(vault)],
    )?;

    Ok(())
}
