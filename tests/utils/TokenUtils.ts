import { web3 } from "@project-serum/anchor";
import {
  AccountLayout,
  MintLayout,
  Token,
  TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import { AccountUtils } from "./AccountUtils";
import { TestUtil } from "./config";
import { KeypairUtils } from "./KeypairUtils";
import { SolUtils } from "./SolUtils";
import { PublicKey, Signer } from "@solana/web3.js"; // Look up the token mint on solscan before adding here

// Look up the token mint on solscan before adding here
export const DECIMALS = {
  USDC: 6,
  BTC: 6,
};

export interface MintToParams {
  token: Token;
  mintAuthority: Signer;
  recipient: PublicKey;
  amount: u64;
}

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

  static async createMints(
    mintAuthorities: PublicKey[],
    decimalsArray: number[]
  ): Promise<Token[]> {
    return await Promise.all(
      mintAuthorities.map((authority, i) =>
        TokenUtils.createMint(authority, decimalsArray[i])
      )
    );
  }

  static async mintTo(params: MintToParams): Promise<PublicKey> {
    const { token, recipient, mintAuthority, amount } = params;
    const ata = await token.createAssociatedTokenAccount(recipient);
    await token.mintTo(
      ata,
      mintAuthority.publicKey,
      [mintAuthority],
      new u64(amount.toString())
    );

    return ata;
  }

  static async mintToBatch(batchParams: MintToParams[]): Promise<PublicKey[]> {
    return await Promise.all(batchParams.map(TokenUtils.mintTo));
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

  static async fetchTokenAccountInfo(pubkey: web3.PublicKey): Promise<{
    address: PublicKey;
    mint: PublicKey;
    owner: PublicKey;
    balance: u64;
    delegate: null | PublicKey;
    delegatedAmount: u64;
    isInitialized: boolean;
    isFrozen: boolean;
    isNative: boolean;
    rentExemptReserve: null | u64;
    closeAuthority: null | PublicKey;
  }> {
    const accountData = await AccountUtils.fetchAccountData(pubkey);
    const decodedData = AccountLayout.decode(accountData);

    return {
      address: new PublicKey(decodedData.address ?? pubkey.toBuffer()),
      mint: new web3.PublicKey(decodedData.mint),
      owner: new web3.PublicKey(decodedData.owner),
      balance: u64.fromBuffer(decodedData.amount),
      delegate: decodedData.delegate
        ? new PublicKey(decodedData.delegate)
        : null,
      delegatedAmount: u64.fromBuffer(decodedData.delegatedAmount),
      isInitialized: decodedData.isInitialized,
      isFrozen: decodedData.isFrozen,
      isNative: decodedData.isNative,
      rentExemptReserve: decodedData.rentExemptReserve
        ? u64.fromBuffer(decodedData.rentExemptReserve)
        : null,
      closeAuthority: decodedData.closeAuthority
        ? new PublicKey(decodedData.closeAuthority)
        : null,
    };
  }

  static async fetchTokenMintInfo(pubkey: web3.PublicKey): Promise<{
    mintAuthority: null | PublicKey;
    supply: u64;
    decimals: number;
    isInitialized: boolean;
    freezeAuthority: null | PublicKey;
  }> {
    const accountData = await AccountUtils.fetchAccountData(pubkey);
    const decodedData = MintLayout.decode(accountData);

    return {
      mintAuthority: decodedData.mintAuthority
        ? new PublicKey(decodedData.mintAuthority.toString())
        : null,
      supply: new u64(decodedData.supply),
      decimals: decodedData.decimals,
      isInitialized: decodedData.isInitialized,
      freezeAuthority: decodedData.freezeAuthority
        ? new PublicKey(decodedData.freezeAuthority.toString())
        : null,
    };
  }

  static async scaleAmount(
    amount: u64 | number | string,
    token: Token
  ): Promise<u64> {
    const mintInfo = await token.getMintInfo();
    return new u64(
      new u64(amount.toString()).mul(
        new u64(10).pow(new u64(mintInfo.decimals))
      )
    );
  }

  /**
   * A function that scales a token amount to its raw representation, i.e. including decimals.
   * For example, 1 USDC is actually represented as 1_000_000 (assuming USDC has 6 decimals).
   * This function batches the async calls to scale each (amount, token) pair and awaits all of them at once.
   * @param {[amount: u64 | number | string, token: Token][]} batchInput - An array of (amount, token) pairs to scale
   */
  static async scaleAmountBatch(
    ...batchInput: [amount: u64 | number | string, token: Token][]
  ): Promise<u64[]> {
    return await Promise.all(
      batchInput.map(([amount, token]) => TokenUtils.scaleAmount(amount, token))
    );
  }
}
