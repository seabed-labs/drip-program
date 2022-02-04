use crate::state::{Vault, VaultPeriod};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositBumps {
    // TODO(matcha)
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
    pub user_position_mint: Account<'info, Mint>,
    pub user_position_token_account: Account<'info, TokenAccount>,
}

pub fn handler(ctx: Context<Deposit>, params: DepositParams) -> ProgramResult {
    // TODO(matcha): Do validations that are not possible via eDSL

    let vault = &mut ctx.accounts.vault;
    let vault_period_end = &mut ctx.accounts.vault_period_end;

    vault_period_end.dar += params.token_a_deposit_amount;
    vault.drip_amount += params.token_a_deposit_amount / params.dca_cycles;

    send_tokens(
        ctx.accounts.token_a_mint.key(),
        ctx.accounts.user_token_a_account.key(),
        ctx.accounts.vault_token_a_account.key(),
        params.token_a_deposit_amount,
    );

    mint_position(
        ctx.accounts.user_position_mint.key(),
        ctx.accounts.user_position_token_account.key(),
    );

    Ok(())
}

fn send_tokens(mint: Pubkey, from: Pubkey, to: Pubkey, amount: u64) {
    // TODO(matcha)
}

fn mint_position(mint: Pubkey, to: Pubkey) {
    // TODO(matcha)
}
