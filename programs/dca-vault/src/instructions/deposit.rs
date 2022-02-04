use crate::state::{Position, Vault, VaultPeriod};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositBumps {
    // TODO(matcha)
    position: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositParams {
    // TODO(matcha)
    bumps: DepositBumps,
    token_a_deposit_amount: u64,
    dca_cycles: u64,
}

#[derive(Accounts)]
#[instruction(params: DepositParams)]
pub struct Deposit<'info> {
    // TODO(matcha): Add eDSL constraints
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    // TODO(matcha): Add another init_vault_period instruction since we can't init or modify always
    #[account(mut)]
    pub vault_period_end: Account<'info, VaultPeriod>,
    pub token_a_mint: Account<'info, Mint>,
    pub vault_token_a_account: Account<'info, TokenAccount>,
    pub user_token_a_account: Account<'info, TokenAccount>,
    #[account(init, payer = depositor)]
    pub user_position: Account<'info, Position>,
    pub user_position_mint: Account<'info, Mint>,
    pub user_position_token_account: Account<'info, TokenAccount>,
    pub depositor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Deposit>, params: DepositParams) -> ProgramResult {
    // TODO(matcha): Do validations that are not possible via eDSL

    let vault = &mut ctx.accounts.vault;
    let vault_period_end = &mut ctx.accounts.vault_period_end;
    let position = &mut ctx.accounts.user_position;
    let now = Clock::get().unwrap().unix_timestamp;

    let periodic_drip_amount = params.token_a_deposit_amount / params.dca_cycles;

    vault_period_end.dar += params.token_a_deposit_amount;
    vault.drip_amount += periodic_drip_amount;
    position.position_authority = ctx.accounts.user_position_mint.key();
    position.deposited_token_a_amount = params.token_a_deposit_amount;
    position.withdrawn_token_b_amount = 0;
    position.vault = vault.key();
    position.deposit_timestamp = now;
    position.dca_period_id_before_deposit = ctx.accounts.vault.last_dca_period;
    position.number_of_swaps = params.dca_cycles;
    position.periodic_drip_amount = periodic_drip_amount;
    position.is_closed = false;

    send_tokens(
        ctx.accounts.token_a_mint.key(),
        ctx.accounts.user_token_a_account.key(),
        ctx.accounts.vault_token_a_account.key(),
        params.token_a_deposit_amount,
    );

    mint_position_nft(
        ctx.accounts.user_position_mint.key(),
        ctx.accounts.user_position_token_account.key(),
    );

    Ok(())
}

fn send_tokens(mint: Pubkey, from: Pubkey, to: Pubkey, amount: u64) {
    // TODO(matcha)
}

fn mint_position_nft(mint: Pubkey, to: Pubkey) {
    // TODO(matcha)
}
