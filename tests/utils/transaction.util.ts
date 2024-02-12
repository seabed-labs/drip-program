import { TestUtil } from "./config.util";
import { Signer, Transaction, TransactionInstruction } from "@solana/web3.js";
import { web3 } from "@coral-xyz/anchor";

export class TransactionUtil extends TestUtil {
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
      signedTx.serialize(),
    );
  }

  static async executeInstructionsWithSigners(
    ixs: TransactionInstruction[],
    signers: Signer[],
  ): Promise<void> {
    const tx = new Transaction({
      feePayer: this.provider.wallet.publicKey,
      recentBlockhash: (await this.provider.connection.getRecentBlockhash())
        .blockhash,
    });

    tx.add(...ixs);
    tx.partialSign(...signers);

    const signedTx = await this.provider.wallet.signTransaction(tx);
    await web3.sendAndConfirmRawTransaction(
      this.provider.connection,
      signedTx.serialize(),
    );
  }
}
