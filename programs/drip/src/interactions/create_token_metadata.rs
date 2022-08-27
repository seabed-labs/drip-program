use crate::sign;
use crate::state::traits::{CPI, PDA};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::{self, Mint};
use anchor_spl::token::{Token, TokenAccount};

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
    position_metadata_account: AccountInfo<'info>,
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
        position_metadata_account: AccountInfo<'info>,
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
            position_metadata_account,
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
                metadata_program.key(),
                position_metadata_account.key(),
                mint.key(),
                vault.key(),
                funder.key(),
                vault.key(),
                DRIP_METADATA_NAME.to_string(),
                DRIP_METADATA_SYMBOL.to_string(),
                get_metadata_url(&mint.key()),
                None,
                0,
                true,
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
            &[sign!(signer)],
        )
    }
}
