use std::fmt;

use crate::state::traits::{CPI, PDA};
use crate::{sign, WhirlpoolProgram};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::{Token, TokenAccount};
use borsh::BorshSerialize;

use super::executor::CpiIdentifier;

pub struct SwapOrcaWhirlpool<'info> {
    whirlpool_program: Program<'info, WhirlpoolProgram>,
    token_program: Program<'info, Token>,
    /// CHECK: not needed here
    token_authority: AccountInfo<'info>,
    /// CHECK: not needed here
    whirlpool: AccountInfo<'info>,
    token_owner_account_a: Box<Account<'info, TokenAccount>>,
    whirlpool_token_vault_a: Box<Account<'info, TokenAccount>>,
    token_owner_account_b: Box<Account<'info, TokenAccount>>,
    whirlpool_token_vault_b: Box<Account<'info, TokenAccount>>,
    /// CHECK: not needed here
    tick_array_0: AccountInfo<'info>,
    /// CHECK: not needed here
    tick_array_1: AccountInfo<'info>,
    /// CHECK: not needed here
    tick_array_2: AccountInfo<'info>,
    /// CHECK: not needed here
    oracle: UncheckedAccount<'info>,
    amount_in: u64,
    sqrt_price_limit: u128,
    a_to_b: bool,
}

impl<'info> SwapOrcaWhirlpool<'info> {
    pub fn new(
        whirlpool_program: &Program<'info, WhirlpoolProgram>,
        token_program: &Program<'info, Token>,
        token_authority: &AccountInfo<'info>,
        whirlpool: &AccountInfo<'info>,
        token_owner_account_a: &Box<Account<'info, TokenAccount>>,
        token_vault_a: &Box<Account<'info, TokenAccount>>,
        token_owner_account_b: &Box<Account<'info, TokenAccount>>,
        token_vault_b: &Box<Account<'info, TokenAccount>>,
        tick_array_0: &AccountInfo<'info>,
        tick_array_1: &AccountInfo<'info>,
        tick_array_2: &AccountInfo<'info>,
        oracle: &UncheckedAccount<'info>,
        amount_in: u64,
        sqrt_price_limit: u128,
    ) -> Self {
        let a_to_b = token_owner_account_a.mint.key() == token_vault_a.mint.key();
        let (token_owner_account_a, token_owner_account_b) = if a_to_b {
            (token_owner_account_a, token_owner_account_b)
        } else {
            (token_owner_account_b, token_owner_account_a)
        };
        SwapOrcaWhirlpool {
            whirlpool_program: whirlpool_program.clone(),
            token_program: token_program.clone(),
            token_authority: token_authority.clone(),
            whirlpool: whirlpool.clone(),
            token_owner_account_a: token_owner_account_a.clone(),
            whirlpool_token_vault_a: token_vault_a.clone(),
            token_owner_account_b: token_owner_account_b.clone(),
            whirlpool_token_vault_b: token_vault_b.clone(),
            tick_array_0: tick_array_0.clone(),
            tick_array_1: tick_array_1.clone(),
            tick_array_2: tick_array_2.clone(),
            oracle: oracle.clone(),
            amount_in,
            sqrt_price_limit,
            a_to_b,
        }
    }
}

impl<'info> fmt::Debug for SwapOrcaWhirlpool<'info> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SwapOrcaWhirlpool")
            .field("whirlpool_program", &self.whirlpool_program.key)
            .field("token_program", &self.token_program.key)
            .field("token_authority", &self.token_authority)
            .field("whirlpool", &self.whirlpool)
            .field("token_owner_account_a", &self.token_owner_account_a)
            .field("whirlpool_token_vault_a", &self.whirlpool_token_vault_a)
            .field("token_owner_account_b", &self.token_owner_account_b)
            .field("whirlpool_token_vault_b", &self.whirlpool_token_vault_b)
            .field("tick_array_0", &self.tick_array_0)
            .field("tick_array_1", &self.tick_array_1)
            .field("tick_array_2", &self.tick_array_2)
            .field("oracle", &self.oracle)
            .field("amount_in", &self.amount_in)
            .field("sqrt_price_limit", &self.sqrt_price_limit)
            .field("a_to_b", &self.a_to_b)
            .finish()
    }
}

#[derive(BorshSerialize)]
struct WhirlpoolSwapParams {
    amount: u64,
    other_amount_threshold: u64,
    sqrt_price_limit: u128,
    amount_specified_is_input: bool,
    a_to_b: bool, // Zero for one
}

impl<'info> CPI for SwapOrcaWhirlpool<'info> {
    fn execute(&self, signer: &dyn PDA) -> Result<()> {
        let params = WhirlpoolSwapParams {
            amount: self.amount_in,
            other_amount_threshold: 1,
            sqrt_price_limit: self.sqrt_price_limit,
            amount_specified_is_input: true,
            a_to_b: self.a_to_b, // Zero for one
        };
        let mut buffer: Vec<u8> = Vec::new();
        params.serialize(&mut buffer).unwrap();

        let ix = Instruction {
            program_id: self.whirlpool_program.key(),
            accounts: vec![
                AccountMeta::new_readonly(self.token_program.key(), false),
                AccountMeta::new_readonly(self.token_authority.key(), true),
                AccountMeta::new(self.whirlpool.key(), false),
                AccountMeta::new(self.token_owner_account_a.key(), false),
                AccountMeta::new(self.whirlpool_token_vault_a.key(), false),
                AccountMeta::new(self.token_owner_account_b.key(), false),
                AccountMeta::new(self.whirlpool_token_vault_b.key(), false),
                AccountMeta::new(self.tick_array_0.key(), false),
                AccountMeta::new(self.tick_array_1.key(), false),
                AccountMeta::new(self.tick_array_2.key(), false),
                AccountMeta::new_readonly(self.oracle.key(), false),
            ],
            data: [hashv(&[b"global:swap"]).to_bytes()[..8].to_vec(), buffer].concat(),
        };

        invoke_signed(
            &ix,
            &[
                self.token_program.to_account_info(),
                self.token_authority.to_account_info(),
                self.whirlpool.to_account_info(),
                self.token_owner_account_a.to_account_info(),
                self.whirlpool_token_vault_a.to_account_info(),
                self.token_owner_account_b.to_account_info(),
                self.whirlpool_token_vault_b.to_account_info(),
                self.tick_array_0.to_account_info(),
                self.tick_array_1.to_account_info(),
                self.tick_array_2.to_account_info(),
                self.oracle.to_account_info(),
            ],
            &[sign!(signer)],
        )?;

        Ok(())
    }

    fn id(&self) -> CpiIdentifier {
        CpiIdentifier::SwapOrcaWhirlpool {
            whirlpool_program: self.whirlpool_program.key(),
            token_program: self.token_program.key(),
            token_authority: self.token_authority.key(),
            whirlpool: self.whirlpool.key(),
            token_owner_account_a: self.token_owner_account_a.key(),
            whirlpool_token_vault_a: self.whirlpool_token_vault_a.key(),
            token_owner_account_b: self.token_owner_account_b.key(),
            whirlpool_token_vault_b: self.whirlpool_token_vault_b.key(),
            tick_array_0: self.tick_array_0.key(),
            tick_array_1: self.tick_array_1.key(),
            tick_array_2: self.tick_array_2.key(),
            oracle: self.oracle.key(),
            amount_in: self.amount_in,
            sqrt_price_limit: self.sqrt_price_limit,
            a_to_b: self.a_to_b,
        }
    }
}
