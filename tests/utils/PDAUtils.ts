import { web3 } from "@project-serum/anchor";
import { TestUtil } from "./config";
import { ProgramUtils } from "./ProgramUtils";

export type PDA = {
  pubkey: web3.PublicKey;
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
    programId: web3.PublicKey,
    seeds: (Uint8Array | Buffer)[]
  ): Promise<PDA> {
    const [pubkey, bump] = await web3.PublicKey.findProgramAddress(
      seeds,
      programId
    );

    return {
      pubkey,
      bump,
    };
  }

  static async findAssociatedTokenAddress(
    walletAddress: web3.PublicKey,
    tokenMintAddress: web3.PublicKey
  ): Promise<web3.PublicKey> {
    return (
      await web3.PublicKey.findProgramAddress(
        [
          walletAddress.toBuffer(),
          ProgramUtils.tokenProgram.programId.toBuffer(),
          tokenMintAddress.toBuffer(),
        ],
        new web3.PublicKey(ProgramUtils.associatedTokenProgram.programId)
      )
    )[0];
  }

  static async getVaultPDA(
    tokenA: web3.PublicKey,
    tokenB: web3.PublicKey,
    protoConfig: web3.PublicKey
  ): Promise<PDA> {
    return await this.findPDA(ProgramUtils.vaultProgram.programId, [
      Buffer.from(CONSTANT_SEEDS.vault),
      tokenA.toBuffer(),
      tokenB.toBuffer(),
      protoConfig.toBuffer(),
    ]);
  }

  static async getVaultPeriodPDA(
    vault: web3.PublicKey,
    periodId: number
  ): Promise<PDA> {
    return await this.findPDA(ProgramUtils.vaultProgram.programId, [
      Buffer.from(CONSTANT_SEEDS.vaultPeriod),
      vault.toBuffer(),
      Buffer.from(periodId.toString()),
    ]);
  }

  static async getPositionPDA(
    vault: web3.PublicKey,
    positionNftMint: web3.PublicKey
  ): Promise<PDA> {
    return await this.findPDA(ProgramUtils.vaultProgram.programId, [
      Buffer.from(CONSTANT_SEEDS.userPosition),
      vault.toBuffer(),
      positionNftMint.toBuffer(),
    ]);
  }
}
