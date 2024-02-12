import { TestUtil } from "./config.util";
import { ProgramUtil } from "./program.util";
import { TransactionUtil } from "./transaction.util";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

export class SolUtil extends TestUtil {
  static solToLamports(sol: number): number {
    return sol * LAMPORTS_PER_SOL;
  }

  static lamportsToSol(lamports: number): number {
    return lamports / LAMPORTS_PER_SOL;
  }

  static async fundAccount(
    address: PublicKey,
    lamports: number,
  ): Promise<void> {
    await TransactionUtil.executeInstructions(
      ProgramUtil.systemProgram.transfer({
        fromPubkey: this.provider.wallet.publicKey,
        toPubkey: address,
        lamports,
      }),
    );
  }

  static async getLamportsBalance(address: PublicKey): Promise<number> {
    return await this.provider.connection.getBalance(address);
  }
}
