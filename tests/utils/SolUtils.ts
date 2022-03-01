import { TestUtil } from "./config";
import { ProgramUtils } from "./ProgramUtils";
import { TransactionUtils } from "./TransactionUtils";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

export class SolUtils extends TestUtil {
  static solToLamports(sol: number): number {
    return sol * LAMPORTS_PER_SOL;
  }

  static lamportsToSol(lamports: number): number {
    return lamports / LAMPORTS_PER_SOL;
  }

  static async fundAccount(
    address: PublicKey,
    lamports: number
  ): Promise<void> {
    await TransactionUtils.executeInstructions(
      ProgramUtils.systemProgram.transfer({
        fromPubkey: this.provider.wallet.publicKey,
        toPubkey: address,
        lamports,
      })
    );
  }
}
