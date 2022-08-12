use crate::errors::ErrorCode::CannotGetVaultBump;
use crate::state::VaultPeriod;
use crate::test_account_size;
use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Vault {
    // total space -> 378
    // allocation needed: ceil( (378+8)/8 )*8 -> 392

    // Account relations
    pub proto_config: Pubkey,             // 32
    pub token_a_mint: Pubkey,             // 32
    pub token_b_mint: Pubkey,             // 32
    pub token_a_account: Pubkey,          // 32
    pub token_b_account: Pubkey,          // 32
    pub treasury_token_b_account: Pubkey, // 32
    pub whitelisted_swaps: [Pubkey; 5],   // 32*5

    // Data
    // 1 to N
    pub last_drip_period: u64,          // 8
    pub drip_amount: u64,               // 8
    pub drip_activation_timestamp: i64, // 8
    pub bump: u8,                       // 1
    pub limit_swaps: bool,              // 1
    pub max_slippage_bps: u16,          // 2
}

impl Vault {
    // total space -> 378
    // allocation needed: ceil( (378+8)/8 )*8 -> 392
    pub const ACCOUNT_SPACE: usize = 392;

    pub fn init(
        &mut self,
        proto_config: Pubkey,
        token_a_mint: Pubkey,
        token_b_mint: Pubkey,
        token_a_account: Pubkey,
        token_b_account: Pubkey,
        treasury_token_b_account: Pubkey,
        whitelisted_swaps: [Pubkey; 5],
        limit_swaps: bool,
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
        self.whitelisted_swaps = whitelisted_swaps;
        self.limit_swaps = limit_swaps;
        self.max_slippage_bps = max_slippage_bps;

        self.last_drip_period = 0;
        self.drip_amount = 0;

        let now = Clock::get().unwrap().unix_timestamp;
        // TODO(matcha): Abstract away this date flooring math and add unit tests
        // TODO(matcha): Figure out how to test this on integration tests without replicating the logic
        // TODO: Use checked_xyz
        self.drip_activation_timestamp = now
            .checked_sub(now % granularity as i64)
            .expect("drip_activation_timestamp math failed");

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

    pub fn process_drip(&mut self, current_period: &Account<VaultPeriod>, granularity: u64) {
        self.drip_amount = self.drip_amount.checked_sub(current_period.dar).unwrap();
        self.last_drip_period = current_period.period_id;

        let now = Clock::get().unwrap().unix_timestamp;
        // TODO(matcha): Abstract away this date flooring math and add unit tests
        // TODO(matcha): Figure out how to test this on integration tests without replicating the logic
        // TODO(matcha): Make sure this makes sense (think through it)
        // Snap it back to the correct activation time stamp
        self.drip_activation_timestamp = now
            .checked_sub(now % granularity as i64)
            .expect("drip_activation_timestamp math process_drip sub")
            .checked_add(granularity as i64)
            .expect("drip_activation_timestamp math process_drip add");
    }

    pub fn is_drip_activated(&self) -> bool {
        let now = Clock::get().unwrap().unix_timestamp;
        now >= self.drip_activation_timestamp
    }

    pub fn seeds(&self) -> [&[u8]; 4] {
        [
            b"drip-v1".as_ref(),
            self.token_a_mint.as_ref(),
            self.token_b_mint.as_ref(),
            self.proto_config.as_ref(),
        ]
    }
}

test_account_size!(Vault);
