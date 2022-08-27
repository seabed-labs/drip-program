use crate::sign;
use crate::state::traits::{CPI, PDA};
use crate::state::Vault;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::Mint;
use anchor_spl::token::{Token, TokenAccount};
use mpl_token_metadata::instruction::create_metadata_accounts_v3;

const DRIP_METADATA_NAME: &str = "Drip Position";
const DRIP_METADATA_SYMBOL: &str = "DP";

fn get_metadata_url(position_nft_mint_pubkey: &Pubkey) -> String {
    format!(
        "https://api.drip.dcaf.so/v1/drip/position/{}/metadata",
        position_nft_mint_pubkey
    )
}

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
    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
    vault: Account<'info, Vault>,
    position_metadata_account: AccountInfo<'info>,
    funder: Signer<'info>,
    mint: Account<'info, Mint>,
    to: Account<'info, TokenAccount>,
    authority: AccountInfo<'info>,
    payer: AccountInfo<'info>,
    rent: Sysvar<'info, Rent>,
    metadata_uri: String,
}

impl<'info> CreateTokenMetadata<'info> {
    pub fn new(
        metadata_program: Program<'info, MetaplexTokenMetadata>,
        token_program: Program<'info, Token>,
        system_program: Program<'info, System>,
        vault: Account<'info, Vault>,
        position_metadata_account: AccountInfo<'info>,
        funder: Signer<'info>,
        mint: Account<'info, Mint>,
        to: Account<'info, TokenAccount>,
        authority: AccountInfo<'info>,
        payer: AccountInfo<'info>,
        rent: Sysvar<'info, Rent>,
        metadata_uri: String,
    ) -> Self {
        CreateTokenMetadata {
            metadata_program,
            token_program,
            system_program,
            vault,
            position_metadata_account,
            funder,
            mint,
            to,
            authority,
            payer,
            rent,
            metadata_uri,
        }
    }
}

impl<'info> CPI for CreateTokenMetadata<'info> {
    fn execute(self, signer: &impl PDA) -> Result<()> {
        invoke_signed(
            &create_metadata_accounts_v3(
                self.metadata_program.key(),
                self.position_metadata_account.key(),
                self.mint.key(),
                self.vault.key(),
                self.funder.key(),
                self.vault.key(),
                DRIP_METADATA_NAME.to_string(),
                DRIP_METADATA_SYMBOL.to_string(),
                self.metadata_uri,
                None,
                0,
                true,
                true,
                None,
                None,
                None,
            ),
            &[
                self.position_metadata_account.to_account_info(),
                self.mint.to_account_info(),
                self.vault.to_account_info(),
                self.vault.to_account_info(),
                self.funder.to_account_info(),
                self.metadata_program.to_account_info(),
                self.system_program.to_account_info(),
                self.rent.to_account_info(),
            ],
            &[sign!(signer)],
        )?;

        Ok(())
    }
}
