import { web3 } from "@project-serum/anchor";
import { AccountLayout, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AccountUtils } from "./AccountUtils";
import { TestUtil } from "./config";
import { KeypairUtils } from "./KeypairUtils";
import { SolUtils } from "./SolUtils";

// Look up the token mint on solscan before adding here
const DECIMALS = {
  USDC: 6,
  BTC: 6,
};

export class TokenUtils extends TestUtil {
  static async createMint(decimals: number): Promise<Token> {
    const funderKeypair = KeypairUtils.generatePair();
    await SolUtils.fundAccount(
      funderKeypair.publicKey,
      SolUtils.solToLamports(10)
    );

    return await Token.createMint(
      this.provider.connection,
      funderKeypair,
      this.provider.wallet.publicKey,
      this.provider.wallet.publicKey,
      decimals,
      TOKEN_PROGRAM_ID
    );
  }

  static async createMockUSDCMint(): Promise<Token> {
    return await this.createMint(DECIMALS.USDC);
  }

  static async createMockBTCMint(): Promise<Token> {
    return await this.createMint(DECIMALS.BTC);
  }

  static async fetchTokenAccountInfo(
    pubkey: web3.PublicKey
  ): Promise<{ mint: web3.PublicKey; owner: web3.PublicKey }> {
    const accountData = await AccountUtils.fetchAccountData(pubkey);
    const decodedData = AccountLayout.decode(accountData);

    return {
      mint: new web3.PublicKey(decodedData.mint),
      owner: new web3.PublicKey(decodedData.owner),
    };
  }
}
