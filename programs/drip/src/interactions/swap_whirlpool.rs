use crate::instructions::drip_orca_whirlpool::WhirlpoolProgram;
use crate::sign;
use crate::state::traits::{CPI, PDA};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::{Token, TokenAccount};
use whirlpool::state::Whirlpool;

use super::drip_utils::WhirlpoolSwapParams;

pub struct SwapWhirlpool<'info> {
    token_program: Program<'info, Token>,
    whirlpool_program: Program<'info, WhirlpoolProgram>,
    /// CHECK: Not needed
    authority: AccountInfo<'info>,
    whirlpool: Account<'info, Whirlpool>,
    source_token_a_account: Account<'info, TokenAccount>,
    whirlpool_token_a_account: Account<'info, TokenAccount>,
    source_token_b_account: Account<'info, TokenAccount>,
    whirlpool_token_b_account: Account<'info, TokenAccount>,
    /// CHECK: Not needed
    tick_array_0: AccountInfo<'info>,
    /// CHECK: Not needed
    tick_array_1: AccountInfo<'info>,
    /// CHECK: Not needed
    tick_array_2: AccountInfo<'info>,
    /// CHECK: Not needed
    oracle: AccountInfo<'info>,
    params: WhirlpoolSwapParams,
}

impl<'info> SwapWhirlpool<'info> {
    pub fn new(
        token_program: Program<'info, Token>,
        whirlpool_program: Program<'info, WhirlpoolProgram>,
        authority: AccountInfo<'info>,
        whirlpool: Account<'info, Whirlpool>,
        source_token_a_account: Account<'info, TokenAccount>,
        whirlpool_token_a_account: Account<'info, TokenAccount>,
        source_token_b_account: Account<'info, TokenAccount>,
        whirlpool_token_b_account: Account<'info, TokenAccount>,
        tick_array_0: AccountInfo<'info>,
        tick_array_1: AccountInfo<'info>,
        tick_array_2: AccountInfo<'info>,
        oracle: AccountInfo<'info>,
        params: WhirlpoolSwapParams,
    ) -> Self {
        SwapWhirlpool {
            token_program,
            whirlpool_program,
            authority,
            whirlpool,
            source_token_a_account,
            whirlpool_token_a_account,
            source_token_b_account,
            whirlpool_token_b_account,
            tick_array_0,
            tick_array_1,
            tick_array_2,
            oracle,
            params,
        }
    }
}

impl<'info> CPI for SwapWhirlpool<'info> {
    fn execute(self, signer: &impl PDA) -> Result<()> {
        let mut buffer: Vec<u8> = Vec::new();
        self.params.serialize(&mut buffer).unwrap();

        let ix = Instruction {
            program_id: self.whirlpool_program.key(),
            accounts: vec![
                AccountMeta::new_readonly(self.token_program.key(), false),
                AccountMeta::new_readonly(self.authority.key(), true),
                AccountMeta::new(self.whirlpool.key(), false),
                AccountMeta::new(self.source_token_a_account.key(), false),
                AccountMeta::new(self.whirlpool_token_a_account.key(), false),
                AccountMeta::new(self.source_token_b_account.key(), false),
                AccountMeta::new(self.whirlpool_token_b_account.key(), false),
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
                self.authority.to_account_info(),
                self.whirlpool.to_account_info(),
                self.source_token_a_account.to_account_info(),
                self.whirlpool_token_a_account.to_account_info(),
                self.source_token_b_account.to_account_info(),
                self.whirlpool_token_b_account.to_account_info(),
                self.tick_array_0.to_account_info(),
                self.tick_array_1.to_account_info(),
                self.tick_array_2.to_account_info(),
                self.oracle.to_account_info(),
            ],
            &[sign!(signer)],
        )?;
        Ok(())
    }
}
