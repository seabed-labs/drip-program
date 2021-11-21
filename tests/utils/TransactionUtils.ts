import { web3 } from "@project-serum/anchor";
import { TestUtil } from "./config";

export class TransactionUtils extends TestUtil {
  static async executeInstructions(...instructions: web3.TransactionInstruction[]): Promise<void> {
    const tx = new web3.Transaction({
      feePayer: this.provider.wallet.publicKey,
      recentBlockhash: (await this.provider.connection.getRecentBlockhash()).blockhash,
    });

    tx.add(...instructions);

    const signedTx = await this.provider.wallet.signTransaction(tx);
    await web3.sendAndConfirmRawTransaction(this.provider.connection, signedTx.serialize());
  }
}