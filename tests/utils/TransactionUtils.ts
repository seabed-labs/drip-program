import { TestUtil } from "./config";
import { Transaction, TransactionInstruction } from "@solana/web3.js";
import { web3 } from "@project-serum/anchor";

export class TransactionUtils extends TestUtil {
  static async executeInstructions(
    ...instructions: TransactionInstruction[]
  ): Promise<void> {
    const tx = new Transaction({
      feePayer: this.provider.wallet.publicKey,
      recentBlockhash: (await this.provider.connection.getRecentBlockhash())
        .blockhash,
    });

    tx.add(...instructions);

    const signedTx = await this.provider.wallet.signTransaction(tx);
    await web3.sendAndConfirmRawTransaction(
      this.provider.connection,
      signedTx.serialize()
    );
  }
}
