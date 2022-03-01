

use anchor_lang::solana_program::program_pack::Pack;
use anchor_lang::solana_program::pubkey::Pubkey;

use std::ops::Deref;

pub use spl_token::ID;

#[derive(Clone)]
pub struct DCASwap(spl_token_swap::state::SwapV1);

impl DCASwap {
    pub const LEN: usize = spl_token_swap::state::SwapV1::LEN;
}

impl anchor_lang::AccountDeserialize for DCASwap {
    fn try_deserialize_unchecked(buf: &mut &[u8]) -> anchor_lang::Result<Self> {
        spl_token_swap::state::SwapV1::unpack(buf)
            .map(DCASwap)
            .map_err(Into::into)
    }
}

impl anchor_lang::AccountSerialize for DCASwap {}

impl anchor_lang::Owner for DCASwap {
    fn owner() -> Pubkey {
        ID
    }
}

impl Deref for DCASwap {
    type Target = spl_token_swap::state::SwapV1;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}