use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct VaultProtoConfig {
    pub granularity: u64,
    // TODO(matcha): Add more stuff here if needed
}
