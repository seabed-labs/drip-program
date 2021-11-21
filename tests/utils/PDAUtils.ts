import { web3 } from "@project-serum/anchor";
import { TestUtil } from "./config";
import { ProgramUtils } from "./ProgramUtils";

export type PDA = {
  pubkey: web3.PublicKey;
  bump: number;
}

const CONSTANT_SEEDS = {
  vault: "dca-vault-v1",
  tokenAAccount: "token_a_account",
  tokenBAccount: "token_b_account",
};

export class PDAUtils extends TestUtil {
  static async findPDA(programId: web3.PublicKey, seeds: (Uint8Array | Buffer)[]): Promise<PDA> {
    const [pubkey, bump] = await web3.PublicKey.findProgramAddress(seeds, programId);

    return {
      pubkey,
      bump
    }
  }

  static async getVaultPDA(tokenA: web3.PublicKey, tokenB: web3.PublicKey, protoConfig: web3.PublicKey): Promise<PDA> {
    return await this.findPDA(ProgramUtils.vaultProgram.programId, [
      Buffer.from(CONSTANT_SEEDS.vault),
      tokenA.toBuffer(),
      tokenB.toBuffer(),
      protoConfig.toBuffer(),
    ]);
  }

  static async getTokenAPDA(vault: web3.PublicKey, tokenA: web3.PublicKey): Promise<PDA> {
    return await this.findPDA(ProgramUtils.vaultProgram.programId, [
      Buffer.from(CONSTANT_SEEDS.tokenAAccount),
      vault.toBuffer(),
      tokenA.toBuffer(),
    ]);
  }

  static async getTokenBPDA(vault: web3.PublicKey, tokenB: web3.PublicKey): Promise<PDA> {
    return await this.findPDA(ProgramUtils.vaultProgram.programId, [
      Buffer.from(CONSTANT_SEEDS.tokenBAccount),
      vault.toBuffer(),
      tokenB.toBuffer(),
    ]);
  }
}