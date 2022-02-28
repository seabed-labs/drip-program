use super::traits::ByteSized;
use crate::common::ErrorCode::CannotGetVaultPeriodBump;
use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct VaultPeriod {
    // Account relations
    pub vault: Pubkey,

    // Data
    pub period_id: u64, // The period index/offset from the genesis period of the vault (0, 1, ...)
    pub twap: u64, // Time weighted average price of asset A expressed in asset B from period 1 to this period
    pub dar: u64,  // Drip amount to reduce at this period

    // Bump
    pub bump: u8,
}

impl VaultPeriod {
    pub fn init(&mut self, vault: Pubkey, period_id: u64, bump: Option<&u8>) -> Result<()> {
        self.vault = vault;
        self.period_id = period_id;
        self.twap = 0;
        self.dar = 0;

        match bump {
            Some(val) => {
                self.bump = *val;
                Ok(())
            }
            None => Err(CannotGetVaultPeriodBump.into()),
        }
    }

    pub fn increase_drip_amount_to_reduce(&mut self, extra_drip: u64) {
        self.dar += extra_drip;
    }
}

impl ByteSized for VaultPeriod {}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn sanity_check_byte_size() {
        assert_eq!(VaultPeriod::byte_size(), 64);
    }
}
