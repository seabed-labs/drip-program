use std::fmt;

use crate::sign;
use crate::state::traits::{CPI, PDA};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::Mint;
use mpl_token_metadata::instruction::create_metadata_accounts_v3;

// TODO: Maybe move this to another location
#[derive(Clone)]
pub struct MetaplexTokenMetadata;

impl Id for MetaplexTokenMetadata {
    fn id() -> Pubkey {
        mpl_token_metadata::ID
    }
}

pub struct CreateTokenMetadata<'info> {
    metadata_program: Program<'info, MetaplexTokenMetadata>,
    system_program: Program<'info, System>,
    /// CHECK: Suppress anchor error, this isn't an IX context struct
    metadata_account: AccountInfo<'info>,
    mint: Account<'info, Mint>,
    /// CHECK: Suppress anchor error, this isn't an IX context struct
    authority: AccountInfo<'info>,
    /// CHECK: Suppress anchor error, this isn't an IX context struct
    payer: AccountInfo<'info>,
    rent: Sysvar<'info, Rent>,
    metadata_uri: String,
    name: String,
    symbol: String,
}

impl<'info> CreateTokenMetadata<'info> {
    pub fn new(
        metadata_program: &Program<'info, MetaplexTokenMetadata>,
        system_program: &Program<'info, System>,
        metadata_account: &AccountInfo<'info>,
        mint: &Account<'info, Mint>,
        authority: &AccountInfo<'info>,
        payer: &AccountInfo<'info>,
        rent: &Sysvar<'info, Rent>,
        metadata_uri: String,
        name: String,
        symbol: String,
    ) -> Self {
        CreateTokenMetadata {
            metadata_program: metadata_program.clone(),
            system_program: system_program.clone(),
            metadata_account: metadata_account.clone(),
            mint: mint.clone(),
            authority: authority.clone(),
            payer: payer.clone(),
            rent: rent.clone(),
            metadata_uri,
            name,
            symbol,
        }
    }
}

impl<'info> fmt::Debug for CreateTokenMetadata<'info> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("CreateTokenMetadata")
            .field("metadata_program", &self.metadata_program.key)
            .field("system_program", &self.system_program)
            .field("metadata_account", &self.metadata_account)
            .field("mint", &self.mint)
            .field("authority", &self.authority)
            .field("payer", &self.payer)
            .field("rent", &self.rent)
            .field("metadata_uri", &self.metadata_uri)
            .field("name", &self.name)
            .field("symbol", &self.symbol)
            .finish()
    }
}

impl<'info> CPI for CreateTokenMetadata<'info> {
    fn execute(&self, signer: &dyn PDA) -> Result<()> {
        invoke_signed(
            &create_metadata_accounts_v3(
                self.metadata_program.key(),
                self.metadata_account.key(),
                self.mint.key(),
                self.authority.key(),
                self.payer.key(),
                self.authority.key(),
                self.name.clone(),
                self.symbol.clone(),
                self.metadata_uri.clone(),
                None,
                0,
                true,
                true,
                None,
                None,
                None,
            ),
            &[
                self.metadata_account.to_account_info(),
                self.mint.to_account_info(),
                self.authority.to_account_info(),
                self.payer.to_account_info(),
                self.authority.to_account_info(),
                self.system_program.to_account_info(),
                self.rent.to_account_info(),
            ],
            &[sign!(signer)],
        )?;

        Ok(())
    }

    fn id(&self) -> String {
        format!("{:?}", self)
    }
}
