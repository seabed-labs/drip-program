use anchor_lang::{
    accounts::account::Account,
    prelude::{AccountInfo, Program, Pubkey, Signer},
    solana_program::stake_history::Epoch,
    system_program::System,
    AccountDeserialize, AccountSerialize, Id, Owner,
};

pub struct AccountFixture<T> {
    key: Pubkey,
    is_signer: bool,
    is_writable: bool,
    lamports: u64,
    data: T,
    owner: Pubkey,
    executable: bool,
    rent_epoch: Epoch,
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

impl<'data> AccountFixture<&'data mut [u8]> {
    pub fn new(data: &'data mut [u8]) -> Self {
        AccountFixture {
            key: Pubkey::new_unique(),
            is_signer: false,
            is_writable: false,
            lamports: 1,
            data,
            owner: System::id(),
            executable: false,
            rent_epoch: 0,
        }
    }

    pub fn new_drip_account(data: &'data mut [u8], is_writable: bool) -> Self {
        let mut account = Self::new(data);
        account.owner = crate::ID;
        account.is_writable = is_writable;

        account
    }

    pub fn to_account_info(&mut self) -> AccountInfo {
        AccountInfo::new(
            &self.key,
            self.is_signer,
            self.is_writable,
            &mut self.lamports,
            self.data,
            &self.owner,
            self.executable,
            self.rent_epoch,
        )
    }

    pub fn to_account<T: AccountSerialize + AccountDeserialize + Owner + Clone>(
        &'data mut self,
    ) -> Account<'data, T> {
        Account::try_from(&self.to_account_info()).unwrap()
    }
}
