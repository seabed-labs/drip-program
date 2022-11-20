use crate::errors::DripError::CannotGetVaultBump;
use crate::math::calculate_drip_activation_timestamp;
use crate::state::traits::PDA;
use crate::state::VaultPeriod;
use crate::test_account_size;
use anchor_lang::prelude::*;

pub const VAULT_SWAP_WHITELIST_SIZE: usize = 5;
pub const MAX_SLIPPAGE_LOWER_LIMIT_EXCLUSIVE: u16 = 0;
pub const MAX_SLIPPAGE_UPPER_LIMIT_EXCLUSIVE: u16 = 10_000;

#[account]
#[derive(Default, Debug)]
pub struct Vault {
    // total space -> 378
    // allocation needed: ceil( (378+8)/8 )*8 -> 392

    // Account relations
    pub proto_config: Pubkey,                                   // 32
    pub token_a_mint: Pubkey,                                   // 32
    pub token_b_mint: Pubkey,                                   // 32
    pub token_a_account: Pubkey,                                // 32
    pub token_b_account: Pubkey,                                // 32
    pub treasury_token_b_account: Pubkey,                       // 32
    pub whitelisted_swaps: [Pubkey; VAULT_SWAP_WHITELIST_SIZE], // 32*5

    // Data
    // 1 to N
    pub last_drip_period: u64,          // 8
    pub drip_amount: u64,               // 8
    pub drip_activation_timestamp: i64, // 8
    pub bump: u8,                       // 1
    pub limit_swaps: bool,              // 1
    pub max_slippage_bps: u16,          // 2

    //  new fields added after mainnet release
    pub oracle_config: Pubkey, // 32
}

impl Vault {
    // total space -> 412
    // allocation needed: ceil( (412+8)/8 )*8 -> 424
    pub const ACCOUNT_SPACE: usize = 424;

    pub fn init(
        &mut self,
        proto_config: Pubkey,
        token_a_mint: Pubkey,
        token_b_mint: Pubkey,
        token_a_account: Pubkey,
        token_b_account: Pubkey,
        treasury_token_b_account: Pubkey,
        whitelisted_swaps: Vec<Pubkey>,
        max_slippage_bps: u16,
        granularity: u64,
        bump: Option<&u8>,
    ) -> Result<()> {
        self.proto_config = proto_config;
        self.token_a_mint = token_a_mint;
        self.token_b_mint = token_b_mint;
        self.token_a_account = token_a_account;
        self.token_b_account = token_b_account;
        self.treasury_token_b_account = treasury_token_b_account;
        self.max_slippage_bps = max_slippage_bps;

        self.last_drip_period = 0;
        self.drip_amount = 0;

        // snap to a timestamp for this granularity, either now or the past
        let now = Clock::get().unwrap().unix_timestamp;
        self.drip_activation_timestamp =
            calculate_drip_activation_timestamp(now, granularity, false);

        self.set_whitelisted_swaps(whitelisted_swaps);

        match bump {
            Some(val) => {
                self.bump = *val;
                Ok(())
            }
            None => Err(CannotGetVaultBump.into()),
        }
    }

    pub fn increase_drip_amount(&mut self, extra_drip: u64) {
        self.drip_amount = self
            .drip_amount
            .checked_add(extra_drip)
            .expect("overflow drip amount");
    }

    pub fn decrease_drip_amount(&mut self, position_drip: u64) {
        self.drip_amount = self.drip_amount.checked_sub(position_drip).unwrap();
    }

    pub fn process_drip(&mut self, current_period: &VaultPeriod, granularity: u64) {
        self.drip_amount = self.drip_amount.checked_sub(current_period.dar).unwrap();
        self.last_drip_period = current_period.period_id;

        // snap to a timestamp for this granularity, either now or in the future
        let now = Clock::get().unwrap().unix_timestamp;
        self.drip_activation_timestamp =
            calculate_drip_activation_timestamp(now, granularity, true);
    }

    pub fn set_whitelisted_swaps(&mut self, whitelisted_swaps: Vec<Pubkey>) {
        self.limit_swaps = !whitelisted_swaps.is_empty();
        self.whitelisted_swaps = Default::default();
        for (i, &swap) in whitelisted_swaps.iter().enumerate() {
            self.whitelisted_swaps[i] = swap;
        }
    }

    pub fn set_max_price_deviation_bps(&mut self, new_max_price_deviation_bps: u16) {
        self.max_slippage_bps = new_max_price_deviation_bps;
    }

    pub fn set_oracle_config(&mut self, new_oracle_config: Pubkey) {
        self.oracle_config = new_oracle_config
    }

    pub fn is_drip_activated(&self) -> bool {
        let now = Clock::get().unwrap().unix_timestamp;
        now >= self.drip_activation_timestamp
    }
}

impl PDA for Vault {
    fn seeds(&self) -> Vec<&[u8]> {
        vec![
            b"drip-v1".as_ref(),
            self.token_a_mint.as_ref(),
            self.token_b_mint.as_ref(),
            self.proto_config.as_ref(),
        ]
    }

    fn bump(&self) -> u8 {
        self.bump
    }
}

test_account_size!(Vault);
