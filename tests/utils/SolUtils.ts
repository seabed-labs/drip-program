import { web3 } from "@project-serum/anchor";
import { TestUtil } from "./config";
import { ProgramUtils } from "./ProgramUtils";
import { TransactionUtils } from "./TransactionUtils";

export class SolUtils extends TestUtil {
  static solToLamports(sol: number): number {
    return sol * web3.LAMPORTS_PER_SOL;
  }
  
  static lamportsToSol(lamports: number): number {
    return lamports / web3.LAMPORTS_PER_SOL;
  }

  static async fundAccount(address: web3.PublicKey, lamports: number): Promise<void> {
    await TransactionUtils.executeInstructions(
      ProgramUtils.systemProgram.transfer({
        fromPubkey: this.provider.wallet.publicKey,
        toPubkey: address,
        lamports,
      })
    );
  }
}