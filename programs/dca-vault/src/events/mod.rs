use anchor_lang::prelude::*;

#[event]
pub struct Log {
    pub data: Option<u64>,
    #[index]
    pub message: String,
}
