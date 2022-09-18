use anchor_lang::prelude::*;
use anchor_lang::{
    accounts::account::Account,
    prelude::{AccountInfo, Program, Pubkey, Signer},
    solana_program::stake_history::Epoch,
    system_program::System,
    AccountDeserialize, AccountSerialize, Id, Owner,
};
use anchor_spl::token::Token;
use lazy_static::lazy_static;

use crate::state::{Vault, VaultPeriod, VaultProtoConfig};

#[account]
#[derive(Default)]
pub struct NoData;

#[derive(Clone)]
pub struct AccountFixture<AnchorAccount>
where
    AnchorAccount: AccountSerialize + AccountDeserialize + Owner + Clone + Default,
{
    pub key: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
    pub lamports: u64,
    pub data: Vec<u8>,
    pub owner: Pubkey,
    pub executable: bool,
    pub rent_epoch: Epoch,
    pub account: AnchorAccount,
}

impl<AnchorAccount> AccountFixture<AnchorAccount>
where
    AnchorAccount: AccountSerialize + AccountDeserialize + Owner + Clone + Default,
{
    pub fn new_system_account() -> Self {
        AccountFixture {
            key: Pubkey::new_unique(),
            is_signer: false,
            is_writable: false,
            lamports: 10,
            data: vec![0],
            owner: System::id(),
            executable: false,
            rent_epoch: 0,
            account: AnchorAccount::default(),
        }
    }

    pub fn new_signer() -> Self {
        let mut account = Self::new_system_account();
        account.is_signer = true;

        account
    }

    pub fn new_program(key: Pubkey) -> Self {
        let mut account = Self::new_system_account();
        account.executable = true;
        account.key = key;

        account
    }

    pub fn new_program_data_account(program_id: Pubkey, state: AnchorAccount) -> Self {
        let mut account = Self::new_system_account();
        account.owner = program_id;

        let mut buf = Vec::new();
        state.try_serialize(&mut buf).unwrap();
        account.data = buf;

        account
    }

    pub fn new_drip_account(state: AnchorAccount) -> Self {
        Self::new_program_data_account(crate::ID, state)
    }

    pub fn new_token_program_account(state: AnchorAccount) -> Self {
        Self::new_program_data_account(Token::id(), state)
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

    pub fn to_account<'info>(&'info mut self) -> Account<'info, AnchorAccount> {
        Account::try_from(&self.to_account_info()).unwrap()
    }

    pub fn to_signer<'info>(&'info mut self) -> Signer<'info> {
        Signer::try_from(&self.to_account_info()).unwrap()
    }

    pub fn to_program<'info, T: Id + Clone>(&'info mut self) -> Program<'info, T> {
        Program::try_from(&self.to_account_info()).unwrap()
    }
}

lazy_static! {
    pub static ref ADMIN: AccountFixture<NoData> = AccountFixture::new_signer();
    pub static ref SYSTEM_PROGRAM: AccountFixture<NoData> =
        AccountFixture::new_program(Pubkey::default());
    pub static ref EMPTY_VAULT_PROTO_CONFIG: AccountFixture<VaultProtoConfig> =
        AccountFixture::new_drip_account(VaultProtoConfig::default());
    pub static ref EMPTY_VAULT_PERIOD: AccountFixture<VaultPeriod> =
        AccountFixture::new_drip_account(VaultPeriod::default());
    pub static ref VAULT_PROTO_CONFIG: AccountFixture<VaultProtoConfig> =
        AccountFixture::new_drip_account(VaultProtoConfig {
            granularity: 60,
            token_a_drip_trigger_spread: 50,
            token_b_withdrawal_spread: 50,
            token_b_referral_spread: 10,
            admin: ADMIN.key,
        });
    // TODO: Use actual mint and token accountn fixtures here
    pub static ref VAULT: AccountFixture<Vault> = AccountFixture::new_drip_account(Vault {
        proto_config: VAULT_PROTO_CONFIG.key,
        token_a_mint: Pubkey::new_unique(),
        token_b_mint: Pubkey::new_unique(),
        token_a_account: Pubkey::new_unique(),
        token_b_account: Pubkey::new_unique(),
        treasury_token_b_account: Pubkey::new_unique(),
        whitelisted_swaps: [Pubkey::new_unique(); 5],
        last_drip_period: 0,
        drip_amount: 50,
        drip_activation_timestamp: 0,
        bump: 0,
        limit_swaps: true,
        max_slippage_bps: 1000,
    });
}
