use anchor_lang::{
    accounts::account::Account,
    prelude::{AccountInfo, Program, Pubkey, Signer},
    solana_program::stake_history::Epoch,
    system_program::System,
    AccountDeserialize, AccountSerialize, Id, Owner,
};

use crate::state::{Vault, VaultPeriod, VaultProtoConfig};

pub struct AccountFixture<T> {
    pub key: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
    pub lamports: u64,
    pub data: T,
    pub owner: Pubkey,
    pub executable: bool,
    pub rent_epoch: Epoch,
}

impl AccountFixture<[u8; 1]> {
    pub fn new() -> Self {
        AccountFixture {
            key: Pubkey::new_unique(),
            is_signer: false,
            is_writable: false,
            lamports: 1,
            data: [0],
            owner: System::id(),
            executable: false,
            rent_epoch: 0,
        }
    }

    pub fn new_signer() -> Self {
        let mut account = Self::new();
        account.is_signer = true;

        account
    }

    pub fn new_program() -> Self {
        let mut account = Self::new();
        account.executable = true;
        account.key = Default::default();

        account
    }

    pub fn to_account_info(&mut self) -> AccountInfo {
        AccountInfo::new(
            &self.key,
            self.is_signer,
            self.is_writable,
            &mut self.lamports,
            &mut self.data,
            &self.owner,
            self.executable,
            self.rent_epoch,
        )
    }

    pub fn to_program<'info, T: Id + Clone>(&'info mut self) -> Program<'info, T> {
        Program::try_from(&self.to_account_info()).unwrap()
    }

    pub fn to_signer<'info>(&'info mut self) -> Signer<'info> {
        Signer::try_from(&self.to_account_info()).unwrap()
    }
}

impl AccountFixture<Vec<u8>> {
    pub fn new() -> Self {
        AccountFixture {
            key: Pubkey::new_unique(),
            is_signer: false,
            is_writable: false,
            lamports: 1,
            data: vec![],
            owner: System::id(),
            executable: false,
            rent_epoch: 0,
        }
    }

    pub fn new_drip_account(is_writable: bool) -> Self {
        let mut account = Self::new();
        account.owner = crate::ID;
        account.is_writable = is_writable;

        account
    }

    pub fn new_vault_proto_config(is_writable: bool, is_empty: bool) -> Self {
        let data = if is_empty {
            VaultProtoConfig::default()
        } else {
            VaultProtoConfig {
                granularity: 1,
                token_a_drip_trigger_spread: 2,
                token_b_withdrawal_spread: 3,
                token_b_referral_spread: 4,
                admin: Pubkey::new_unique(),
            }
        };

        let mut buf = Vec::new();
        data.try_serialize(&mut buf).unwrap();

        let mut account = Self::new_drip_account(is_writable);
        account.data = buf;

        account
    }

    pub fn new_vault_period(is_writable: bool, is_empty: bool) -> Self {
        let data = if is_empty {
            VaultPeriod::default()
        } else {
            VaultPeriod {
                vault: Pubkey::new_unique(),
                period_id: 0,
                dar: 0,
                twap: 0,
                drip_timestamp: 0,
                bump: 0,
            }
        };

        let mut buf = Vec::new();
        data.try_serialize(&mut buf).unwrap();

        let mut account = Self::new_drip_account(is_writable);
        account.data = buf;

        account
    }

    pub fn new_vault(is_writable: bool, is_empty: bool) -> Self {
        let data = if is_empty {
            Vault::default()
        } else {
            Vault {
                proto_config: Pubkey::new_unique(),
                token_a_mint: Pubkey::new_unique(),
                token_b_mint: Pubkey::new_unique(),
                token_a_account: Pubkey::new_unique(),
                token_b_account: Pubkey::new_unique(),
                treasury_token_b_account: Pubkey::new_unique(),
                whitelisted_swaps: [
                    Pubkey::new_unique(),
                    Pubkey::new_unique(),
                    Pubkey::new_unique(),
                    Pubkey::new_unique(),
                    Pubkey::new_unique(),
                ],
                last_drip_period: 0,
                drip_amount: 0,
                drip_activation_timestamp: 0,
                bump: 0,
                limit_swaps: true,
                max_slippage_bps: 100,
            }
        };

        let mut buf = Vec::new();
        data.try_serialize(&mut buf).unwrap();

        let mut account = Self::new_drip_account(is_writable);
        account.data = buf;

        account
    }

    pub fn to_account_info(&mut self) -> AccountInfo {
        AccountInfo::new(
            &self.key,
            self.is_signer,
            self.is_writable,
            &mut self.lamports,
            self.data.as_mut_slice(),
            &self.owner,
            self.executable,
            self.rent_epoch,
        )
    }

    pub fn to_account<'info, T: AccountSerialize + AccountDeserialize + Owner + Clone>(
        &'info mut self,
    ) -> Account<'info, T> {
        Account::try_from(&self.to_account_info()).unwrap()
    }
}
