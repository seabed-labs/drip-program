import { TestUtil } from "./config";
import { ProgramUtils } from "./ProgramUtils";
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

export class PDAUtils extends TestUtil {
  static async findPDA(
    programId: PublicKey,
    seeds: (Uint8Array | Buffer)[]
  ): Promise<PDA> {
    const [publicKey, bump] = await PublicKey.findProgramAddress(
      seeds,
      programId
    );
    return {
      publicKey,
      bump,
    };
  }

  static async findAssociatedTokenAddress(
    walletAddress: PublicKey,
    tokenMintAddress: PublicKey
  ): Promise<PublicKey> {
    return (
      await PublicKey.findProgramAddress(
        [
          walletAddress.toBuffer(),
          ProgramUtils.tokenProgram.programId.toBuffer(),
          tokenMintAddress.toBuffer(),
        ],
        new PublicKey(ProgramUtils.associatedTokenProgram.programId)
      )
    )[0];
  }

  static async getVaultPDA(
    tokenA: PublicKey,
    tokenB: PublicKey,
    protoConfig: PublicKey
  ): Promise<PDA> {
    return await this.findPDA(ProgramUtils.vaultProgram.programId, [
      Buffer.from(CONSTANT_SEEDS.vault),
      tokenA.toBuffer(),
      tokenB.toBuffer(),
      protoConfig.toBuffer(),
    ]);
  }

  static async getVaultPeriodPDA(
    vault: PublicKey,
    periodId: number
  ): Promise<PDA> {
    return await this.findPDA(ProgramUtils.vaultProgram.programId, [
      Buffer.from(CONSTANT_SEEDS.vaultPeriod),
      vault.toBuffer(),
      Buffer.from(periodId.toString()),
    ]);
  }

  static async getPositionPDA(
    vault: PublicKey,
    positionNftMint: PublicKey
  ): Promise<PDA> {
    return await this.findPDA(ProgramUtils.vaultProgram.programId, [
      Buffer.from(CONSTANT_SEEDS.userPosition),
      vault.toBuffer(),
      positionNftMint.toBuffer(),
    ]);
  }

  static async getSwapAuthorityPDA(swap: PublicKey): Promise<PDA> {
    return await this.findPDA(ProgramUtils.tokenSwapProgram.programId, [
      swap.toBuffer(),
    ]);
  }
}
