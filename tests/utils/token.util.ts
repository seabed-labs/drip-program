import {
  Account,
  AccountLayout,
  Mint,
  MintLayout,
  TOKEN_PROGRAM_ID,
  approve,
  createAccount,
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { TestUtil } from "./config.util";
import { SolUtil } from "./sol.util";
import { Keypair, PublicKey, Signer } from "@solana/web3.js";
import { generatePair } from "./common.util"; // Look up the token mint on solscan before adding here
import { ProgramUtil } from "./program.util";

// Look up the token mint on solscan before adding here
export const DECIMALS = {
  USDC: 6,
  BTC: 6,
};

export interface MintToParams {
  payer: Signer;
  token: Mint;
  mintAuthority: Signer;
  recipient: PublicKey;
  amount: bigint;
}

export class TokenUtil extends TestUtil {
  static fetchMint(mint: PublicKey): Promise<Mint> {
    return getMint(
      TokenUtil.provider.connection,
      mint,
      undefined,
      ProgramUtil.tokenProgram.programId,
    );
  }

  static async createMint(
    mintAuthority: PublicKey,
    freezeAuthority: PublicKey = null,
    decimals: number = 6,
    funderKeypair?: Keypair,
  ): Promise<Mint> {
    if (!funderKeypair) {
      funderKeypair = generatePair();
      await SolUtil.fundAccount(
        funderKeypair.publicKey,
        SolUtil.solToLamports(0.1),
      );
    }

    const mintPubkey = await createMint(
      TokenUtil.provider.connection,
      funderKeypair,
      mintAuthority,
      freezeAuthority,
      decimals,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID,
    );
    return getMint(
      TokenUtil.provider.connection,
      mintPubkey,
      undefined,
      TOKEN_PROGRAM_ID,
    );
  }

  static async createMints(
    mintAuthorities: PublicKey[],
    decimalsArray: number[],
  ): Promise<Mint[]> {
    return await Promise.all(
      mintAuthorities.map((authority, i) =>
        TokenUtil.createMint(authority, authority, decimalsArray[i]),
      ),
    );
  }

  static async createTokenAccount(
    token: Mint,
    owner: PublicKey,
    payer: Signer,
  ): Promise<PublicKey> {
    return createAccount(
      TokenUtil.provider.connection,
      payer,
      token.address,
      owner,
      new Keypair(),
    );
  }

  static async getOrCreateAssociatedTokenAccount(
    token: Mint,
    owner: PublicKey,
    payer: Signer,
  ): Promise<PublicKey> {
    const ataInfo = await getOrCreateAssociatedTokenAccount(
      TokenUtil.provider.connection,
      payer,
      token.address,
      owner,
      true,
    );
    return ataInfo.address;
  }

  static async getTokenAccount(tokenAccount: PublicKey): Promise<Account> {
    return getAccount(TokenUtil.provider.connection, tokenAccount);
  }

  static async mintTo(params: MintToParams): Promise<PublicKey> {
    const { token, payer, recipient, mintAuthority, amount } = params;
    await mintTo(
      TokenUtil.provider.connection,
      payer,
      token.address,
      recipient,
      mintAuthority,
      amount,
    );
    return recipient;
  }

  static async mintToBatch(batchParams: MintToParams[]): Promise<PublicKey[]> {
    return await Promise.all(batchParams.map(TokenUtil.mintTo));
  }

  static async createMockUSDCMint(
    minter: PublicKey = TokenUtil.provider.wallet.publicKey,
  ): Promise<Mint> {
    return await TokenUtil.createMint(minter, minter, DECIMALS.USDC);
  }

  static async createMockBTCMint(
    minter: PublicKey = TokenUtil.provider.wallet.publicKey,
  ): Promise<Mint> {
    return await TokenUtil.createMint(minter, minter, DECIMALS.BTC);
  }

  static async fetchTokenAccountInfo(pubkey: PublicKey): Promise<Account> {
    return getAccount(TokenUtil.provider.connection, pubkey);
  }

  static scaleAmount(amount: bigint | number | string, token: Mint): bigint {
    amount = BigInt(amount);
    return amount * BigInt(10 ** token.decimals);
  }

  /**
   * A function that scales a token amount to its raw representation, i.e. including decimals.
   * For example, 1 USDC is actually represented as 1_000_000 (assuming USDC has 6 decimals).
   * This function batches the async calls to scale each (amount, token) pair and awaits all of them at once.
   * @param {[amount: bigint | number | string, token: Token][]} batchInput - An array of (amount, token) pairs to scale
   */
  static async scaleAmountBatch(
    ...batchInput: [amount: bigint | number | string, token: Mint][]
  ): Promise<bigint[]> {
    return await Promise.all(
      batchInput.map(([amount, token]) => TokenUtil.scaleAmount(amount, token)),
    );
  }
}
