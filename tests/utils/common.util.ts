import { u64 } from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";

export enum Denom {
  Hundred = 100,
  Thousand = 1_000,
  Million = 1_000_000,
  Billion = 1_000_000_000,
}

export function amount(base: u64 | number | string, denom: Denom): u64 {
  return new u64(new u64(base.toString()).mul(new u64(denom.toString())));
}

const SECONDS_IN_A_MINUTE = 60;
const MINUTES_IN_AN_HOUR = 60;
const HOURS_IN_A_DAY = 24;
const DAYS_IN_A_YEAR = 365.25;
const SECONDS_IN_A_YEAR =
  DAYS_IN_A_YEAR * HOURS_IN_A_DAY * MINUTES_IN_AN_HOUR * SECONDS_IN_A_MINUTE;
const WEEKS_IN_A_YEAR = 52;
const MONTHS_IN_A_YEAR = 12;

const SECONDS_IN_A_HOUR = SECONDS_IN_A_MINUTE * MINUTES_IN_AN_HOUR;
const SECONDS_IN_A_DAY =
  SECONDS_IN_A_MINUTE * MINUTES_IN_AN_HOUR * HOURS_IN_A_DAY;
const SECONDS_IN_A_WEEK = SECONDS_IN_A_YEAR / WEEKS_IN_A_YEAR;
const SECONDS_IN_A_MONTH = SECONDS_IN_A_YEAR / MONTHS_IN_A_YEAR;

export enum Granularity {
  HOURLY = SECONDS_IN_A_HOUR,
  DAILY = SECONDS_IN_A_DAY,
  WEEKLY = SECONDS_IN_A_WEEK,
  MONTHLY = SECONDS_IN_A_MONTH,
}

export type AsyncReturnType<T extends (...args: any) => any> = T extends (
  ...args: any
) => Promise<infer U>
  ? U
  : T extends (...args: any) => infer U
  ? U
  : any;

export const generatePair = () => {
  return Keypair.generate();
};
export const generatePairs = (count: number) => {
  return [...Array(count).keys()].map(generatePair);
};

import { TestUtil } from "./config";
import { ProgramUtil } from "./Program.util";
import { PublicKey } from "@solana/web3.js";

export type PDA = {
  publicKey: PublicKey;
  bump: number;
};

export const CONSTANT_SEEDS = {
  vault: "dca-vault-v1",
  tokenAAccount: "token_a_account",
  tokenBAccount: "token_b_account",
  vaultPeriod: "vault_period",
  userPosition: "user_position",
};

// export class PDAUtil extends TestUtil {
export const findPDA = async (
  programId: PublicKey,
  seeds: (Uint8Array | Buffer)[]
) => {
  const [publicKey, bump] = await PublicKey.findProgramAddress(
    seeds,
    programId
  );
  return {
    publicKey,
    bump,
  };
};

export const findAssociatedTokenAddress = async (
  walletAddress: PublicKey,
  tokenMintAddress: PublicKey
) => {
  return (
    await PublicKey.findProgramAddress(
      [
        walletAddress.toBuffer(),
        ProgramUtil.tokenProgram.programId.toBuffer(),
        tokenMintAddress.toBuffer(),
      ],
      new PublicKey(ProgramUtil.associatedTokenProgram.programId)
    )
  )[0];
};

export const getVaultPDA = async (
  tokenA: PublicKey,
  tokenB: PublicKey,
  protoConfig: PublicKey
) => {
  return findPDA(ProgramUtil.vaultProgram.programId, [
    Buffer.from(CONSTANT_SEEDS.vault),
    tokenA.toBuffer(),
    tokenB.toBuffer(),
    protoConfig.toBuffer(),
  ]);
};

export const getVaultPeriodPDA = async (vault: PublicKey, periodId: number) => {
  return findPDA(ProgramUtil.vaultProgram.programId, [
    Buffer.from(CONSTANT_SEEDS.vaultPeriod),
    vault.toBuffer(),
    Buffer.from(periodId.toString()),
  ]);
};

export const getPositionPDA = async (
  vault: PublicKey,
  positionNftMint: PublicKey
) => {
  return findPDA(ProgramUtil.vaultProgram.programId, [
    Buffer.from(CONSTANT_SEEDS.userPosition),
    vault.toBuffer(),
    positionNftMint.toBuffer(),
  ]);
};

export const getSwapAuthorityPDA = async (swap: PublicKey) => {
  return findPDA(ProgramUtil.tokenSwapProgram.programId, [swap.toBuffer()]);
};
