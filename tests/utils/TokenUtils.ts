import { BN, web3 } from "@project-serum/anchor";
import { AccountLayout, Token, TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";
import { AccountUtils } from "./AccountUtils";
import { TestUtil } from "./config";
import { KeypairUtils } from "./KeypairUtils";
import { SolUtils } from "./SolUtils";
import { PublicKey, Signer } from "@solana/web3.js";

// Look up the token mint on solscan before adding here
const DECIMALS = {
  USDC: 6,
  BTC: 6,
};

export class TokenUtils extends TestUtil {
  static async createMint(
    mintAuthority: PublicKey,
    decimals: number
  ): Promise<Token> {
    const funderKeypair = KeypairUtils.generatePair();
    await SolUtils.fundAccount(
      funderKeypair.publicKey,
      SolUtils.solToLamports(10)
    );

    return await Token.createMint(
      this.provider.connection,
      funderKeypair,
      mintAuthority,
      mintAuthority,
      decimals,
      TOKEN_PROGRAM_ID
    );
  }

  static async mintTo(
    token: Token,
    minter: Signer,
    recipient: PublicKey,
    amount: u64
  ): Promise<void> {
    const ata = await token.createAssociatedTokenAccount(recipient);
    await token.mintTo(ata, minter, [minter], new u64(1_000_000_000));
  }

  static async createMockUSDCMint(
    minter: PublicKey = this.provider.wallet.publicKey
  ): Promise<Token> {
    return await this.createMint(minter, DECIMALS.USDC);
  }

  static async createMockBTCMint(
    minter: PublicKey = this.provider.wallet.publicKey
  ): Promise<Token> {
    return await this.createMint(minter, DECIMALS.BTC);
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
