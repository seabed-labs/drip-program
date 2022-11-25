use crate::state::{OracleConfig, Vault, VaultPeriod, VaultProtoConfig};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_option::COption;
use anchor_lang::{
    accounts::account::Account,
    prelude::{AccountInfo, Program, Pubkey, Signer},
    solana_program::program_pack::Pack,
    solana_program::stake_history::Epoch,
    system_program::System,
    AccountDeserialize, AccountSerialize, Id, Owner,
};
use anchor_spl::token::{Mint, Token, TokenAccount};
use lazy_static::lazy_static;
use spl_token::state::AccountState;

#[account]
#[derive(Default)]
pub struct NoData {
    data: u8,
}

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
    pub fn new_system_account(key: Option<Pubkey>) -> Self {
        AccountFixture {
            key: key.map_or_else(Pubkey::new_unique, |key| key),
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

    pub fn new_signer(key: Option<Pubkey>) -> Self {
        let mut account = Self::new_system_account(key);
        account.is_signer = true;

        account
    }

    pub fn new_program(key: Pubkey) -> Self {
        let mut account = Self::new_system_account(Some(key));
        account.executable = true;

        account
    }

    pub fn new_program_data_account(
        program_id: Pubkey,
        state: AnchorAccount,
        key: Option<Pubkey>,
    ) -> Self {
        let mut account = Self::new_system_account(key);
        account.owner = program_id;

        let mut buf = Vec::new();
        state.try_serialize(&mut buf).unwrap();
        account.data = buf;

        account
    }

    pub fn new_drip_account(state: AnchorAccount, key: Option<Pubkey>) -> Self {
        Self::new_program_data_account(crate::ID, state, key)
    }

    pub fn new_token_program_account(state: AnchorAccount, key: Option<Pubkey>) -> Self {
        Self::new_program_data_account(Token::id(), state, key)
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

    pub fn to_account(&mut self) -> Account<AnchorAccount> {
        Account::try_from(&self.to_account_info()).unwrap()
    }

    pub fn to_signer(&mut self) -> Signer {
        Signer::try_from(&self.to_account_info()).unwrap()
    }

    pub fn to_program<T: Id + Clone>(&mut self) -> Program<T> {
        Program::try_from(&self.to_account_info()).unwrap()
    }
}

pub fn new_anchor_wrapped_account<
    AnchorWrapperAccount: AccountDeserialize,
    InnerSolanaAccount: Pack,
>(
    account: InnerSolanaAccount,
) -> AnchorWrapperAccount {
    let mut buff: Vec<u8> = vec![0; InnerSolanaAccount::LEN];
    InnerSolanaAccount::pack(account, &mut buff).unwrap();
    AnchorWrapperAccount::try_deserialize(&mut buff.as_slice()).unwrap()
}

lazy_static! {
    pub static ref ADMIN: AccountFixture<NoData> = AccountFixture::new_signer(None);
    pub static ref SYSTEM_PROGRAM: AccountFixture<NoData> =
        AccountFixture::new_program(Pubkey::default());
    pub static ref EMPTY_VAULT_PROTO_CONFIG: AccountFixture<VaultProtoConfig> =
        AccountFixture::new_drip_account(VaultProtoConfig::default(), None);
    pub static ref EMPTY_VAULT_PERIOD: AccountFixture<VaultPeriod> =
        AccountFixture::new_drip_account(VaultPeriod::default(), None);
    pub static ref VAULT_PROTO_CONFIG: AccountFixture<VaultProtoConfig> =
        AccountFixture::new_drip_account(VaultProtoConfig {
            granularity: 60,
            token_a_drip_trigger_spread: 50,
            token_b_withdrawal_spread: 50,
            token_b_referral_spread: 10,
            admin: ADMIN.key,
        }, None);


    pub static ref TOKEN_A_MINT: AccountFixture<Mint> = AccountFixture::new_token_program_account(
        new_anchor_wrapped_account(spl_token::state::Mint {
            mint_authority: COption::None,
            supply: 1_000_000_000_000_000, // 1 billion
            decimals: 6,
            is_initialized: true,
            freeze_authority: COption::None,
        }),
        None
    );

    pub static ref TOKEN_A_PRICE: AccountFixture<NoData> = AccountFixture::new_system_account(None);

    pub static ref TOKEN_B_PRICE: AccountFixture<NoData> = AccountFixture::new_system_account(None);

    pub static ref ORACLE_CONFIG: AccountFixture<OracleConfig> =
        AccountFixture::new_drip_account(OracleConfig {
            enabled: true,
            source: 0,
            update_authority: ADMIN.key,
            token_a_mint: TOKEN_A_MINT.key,
            token_a_price: TOKEN_A_PRICE.key,
            token_b_mint: TOKEN_B_MINT.key,
            token_b_price: TOKEN_B_PRICE.key,
        }, None
    );


    pub static ref TOKEN_B_MINT: AccountFixture<Mint> = AccountFixture::new_token_program_account(
        new_anchor_wrapped_account(spl_token::state::Mint {
            mint_authority: COption::None,
            supply: 1_000_000_000_000_000, // 1 billion
            decimals: 6,
            is_initialized: true,
            freeze_authority: COption::None,
        }),
        None
    );

    pub static ref VAULT_TOKEN_A_ACCOUNT: AccountFixture<TokenAccount> = AccountFixture::new_token_program_account(
        new_anchor_wrapped_account(spl_token::state::Account {
            mint: Pubkey::new_unique(),
            owner: ADMIN.key,
            amount: 1_000_000_000_000, // 1 Million
            delegate: COption::None,
            state: AccountState::Initialized,
            is_native: COption::None,
            delegated_amount: 0,
            close_authority: COption::None,
        }),
        None
    );

    pub static ref VAULT_TOKEN_B_ACCOUNT: AccountFixture<TokenAccount> = AccountFixture::new_token_program_account(
        new_anchor_wrapped_account(spl_token::state::Account {
            mint: TOKEN_B_MINT.key,
            owner: ADMIN.key,
            amount: 1_000_000_000_000, // 1 Million
            delegate: COption::None,
            state: AccountState::Initialized,
            is_native: COption::None,
            delegated_amount: 0,
            close_authority: COption::None,
        }),
        None
    );

    pub static ref VAULT_TREASURY_TOKEN_B_ACCOUNT: AccountFixture<TokenAccount> = AccountFixture::new_token_program_account(
        new_anchor_wrapped_account(spl_token::state::Account {
            mint: TOKEN_B_MINT.key,
            owner: ADMIN.key,
            amount: 0, // 0
            delegate: COption::None,
            state: AccountState::Initialized,
            is_native: COption::None,
            delegated_amount: 0,
            close_authority: COption::None,
        }),
        None
    );

    pub static ref WHITELISTED_SWAP_1: AccountFixture<NoData> = AccountFixture::new_system_account(None);
    pub static ref WHITELISTED_SWAP_2: AccountFixture<NoData> = AccountFixture::new_system_account(None);
    pub static ref WHITELISTED_SWAP_3: AccountFixture<NoData> = AccountFixture::new_system_account(None);

    pub static ref VAULT_PERIOD_0: AccountFixture<VaultPeriod> = AccountFixture::new_drip_account(
        VaultPeriod {
            vault: VAULT.key,
            period_id: 0,
            dar: 10,
            twap: 0,
            drip_timestamp: 0,
            bump: 0,
        },
        None
    );

    pub static ref VAULT_PERIOD_1: AccountFixture<VaultPeriod> = AccountFixture::new_drip_account(
        VaultPeriod {
            vault: VAULT.key,
            period_id: 1,
            dar: 10,
            twap: 0,
            drip_timestamp: 0,
            bump: 0,
        },
        None
    );

    pub static ref VAULT: AccountFixture<Vault> = AccountFixture::new_drip_account(Vault {
        proto_config: VAULT_PROTO_CONFIG.key,
        token_a_mint: TOKEN_A_MINT.key,
        token_b_mint: TOKEN_B_MINT.key,
        token_a_account: VAULT_TOKEN_A_ACCOUNT.key,
        token_b_account: VAULT_TOKEN_B_ACCOUNT.key,
        treasury_token_b_account: VAULT_TREASURY_TOKEN_B_ACCOUNT.key,
        whitelisted_swaps: [WHITELISTED_SWAP_1.key, WHITELISTED_SWAP_2.key, WHITELISTED_SWAP_3.key, Pubkey::default(), Pubkey::default()],
        last_drip_period: 0,
        drip_amount: 50,
        drip_activation_timestamp: 0,
        bump: 0,
        limit_swaps: true,
        max_slippage_bps: 1000,
        oracle_config: ORACLE_CONFIG.key,
        max_price_deviation_bps: 1000,
    }, None);
}
