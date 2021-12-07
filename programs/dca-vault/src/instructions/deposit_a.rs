use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount};
use crate::state::{Vault, Position, ByteSized, VaultProtoConfig};
use anchor_spl::token::Mint;
use anchor_spl::token::Token;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializePositionBumps {
    position: u8,
    depositor_token_a_account: u8,
    token_a_account: u8,
}

#[derive(Accounts)]
#[instruction(bumps: InitializePositionBumps, deposit_amount: u64, expiry_date_millis: u64)]
pub struct DepositA<'info> {
    // User Account
    pub depositor: Signer<'info>,

    // The vault where the token will be deposited
    #[account(mut,
        has_one = vault_proto_config,
        seeds = [
            b"dca-vault-v1".as_ref(),
            token_a_mint.key().as_ref(),
            token_b_mint.key().as_ref(),
            vault_proto_config.key().as_ref(),
        ],
        bump = vault.__nonce)]
    pub vault: Account<'info, Vault>,

    pub vault_proto_config: Account<'info, VaultProtoConfig>,

    // Vault position account 
    #[account(
        init,
        seeds = [
            b"position".as_ref(),
            vault.key().as_ref(),
            depositor.key().as_ref(),
        ],
        bump = bumps.position,
        payer = depositor,
        space = 8 + Position::byte_size()
    )]
    pub position: Account<'info, Position>,

    //  Need to add some macros for validation
    #[account(mut)]
    pub depositor_token_a_account: Account<'info, TokenAccount>,

    // Needed only if we transfer token from
    // depositor_token_a_account -> vault.token_a_account in deposit
    #[account(
        mut,
        seeds = [
            b"token_a_account".as_ref(),
            vault.key().as_ref(),
            token_a_mint.key().as_ref(),
        ],
        bump = bumps.token_a_account,
    )]
    pub token_a_account: Account<'info, TokenAccount>,

    pub token_a_mint: Account<'info, Mint>,
    pub token_b_mint: Account<'info, Mint>,

    #[account(address = anchor_spl::token::ID)]
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>
}

pub fn handler(ctx: Context<DepositA>, bumps: InitializePositionBumps, deposit_amount: u32, expiry_date_millis: u128) -> ProgramResult {
    let position = &mut ctx.accounts.position;
    let vault = &mut ctx.accounts.vault;

    position.position_authority = ctx.accounts.depositor.key();
    position.deposit_amount_token_a = deposit_amount;
    position.expiry_date_millis = expiry_date_millis;
    position.dripped_amount_token_b = 0;
    position.is_closed = false;

    let start = SystemTime::now();
    let since_the_epoch = start
        .duration_since(UNIX_EPOCH).expect("Ok");
    position.deposit_date_millis = since_the_epoch.as_millis();

    // TODO: Finalize how we want to define the timestamps throughout the project
    let dca_duration = expiry_date_millis - since_the_epoch.as_millis();
    let granulairity = ctx.accounts.vault_proto_config.granularity;

    // TODO: We'll need to do safe math that accounts for underflow and overflow
    position.number_of_swaps = (dca_duration / granulairity) as u32;
    position.amount_per_period = deposit_amount / position.number_of_swaps;

    // Update vault's drip amount after every new user deposit
    vault.drip_amount += position.amount_per_period;
    position.vault = vault.key();

    // TODO (pranav): CPI using token program to transfer money from 
    // depositor_token_a_account -> vault.token_a_account

    msg!("Deposited A");
    Ok(())
}