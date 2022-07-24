import {
  AccountLayout,
  MintLayout,
  Token,
  TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import { AccountUtil } from "./account.util";
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
  token: Token;
  mintAuthority: Signer;
  recipient: PublicKey;
  amount: u64;
}

export class TokenUtil extends TestUtil {
  static fetchMint(mint: PublicKey, payer: Keypair = generatePair()): Token {
    return new Token(
      this.provider.connection,
      mint,
      ProgramUtil.tokenProgram.programId,
      payer
    );
  }

  static async createMint(
    mintAuthority: PublicKey,
    freezeAuthority: PublicKey = null,
    decimals: number = 6,
    funderKeypair: Keypair = generatePair(),
    shouldFund = true
  ): Promise<Token> {
    if (shouldFund) {
      await SolUtil.fundAccount(
        funderKeypair.publicKey,
        SolUtil.solToLamports(0.1)
      );
    }

    return await Token.createMint(
      this.provider.connection,
      funderKeypair,
      mintAuthority,
      freezeAuthority,
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
        TokenUtil.createMint(authority, authority, decimalsArray[i])
      )
    );
  }

  static async createTokenAccount(
    token: Token,
    owner: PublicKey
  ): Promise<PublicKey> {
    return await token.createAccount(owner);
  }

  static async getOrCreateAssociatedTokenAccount(
    token: Token,
    owner: PublicKey
  ): Promise<PublicKey> {
    const ataInfo = await token.getOrCreateAssociatedAccountInfo(owner);
    return new PublicKey(ataInfo.address);
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
    return await Promise.all(batchParams.map(TokenUtil.mintTo));
  }

  static async createMockUSDCMint(
    minter: PublicKey = this.provider.wallet.publicKey
  ): Promise<Token> {
    return await this.createMint(minter, minter, DECIMALS.USDC);
  }

  static async createMockBTCMint(
    minter: PublicKey = this.provider.wallet.publicKey
  ): Promise<Token> {
    return await this.createMint(minter, minter, DECIMALS.BTC);
  }

  static async fetchTokenAccountInfo(pubkey: PublicKey): Promise<{
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
    const accountData = await AccountUtil.fetchAccountData(pubkey);
    // TODO(Mocha): define module for decode
    const decodedData = AccountLayout.decode(accountData);

    return {
      address: new PublicKey(decodedData.address ?? pubkey.toBuffer()),
      mint: new PublicKey(decodedData.mint),
      owner: new PublicKey(decodedData.owner),
      balance: u64.fromBuffer(decodedData.amount),
      delegate:
        decodedData.delegateOption === 1
          ? new PublicKey(decodedData.delegate)
          : null,
      delegatedAmount: u64.fromBuffer(decodedData.delegatedAmount),
      isInitialized: decodedData.isInitialized,
      isFrozen: decodedData.isFrozen,
      isNative: decodedData.isNative,
      rentExemptReserve:
        decodedData.rentExemptReserveOption === 1
          ? u64.fromBuffer(decodedData.rentExemptReserve)
          : null,
      closeAuthority:
        decodedData.closeAuthority === 1
          ? new PublicKey(decodedData.closeAuthority)
          : null,
    };
  }

  static async fetchTokenMintInfo(pubkey: PublicKey): Promise<{
    mintAuthority: null | PublicKey;
    supply: u64;
    decimals: number;
    isInitialized: boolean;
    freezeAuthority: null | PublicKey;
  }> {
    const accountData = await AccountUtil.fetchAccountData(pubkey);
    const decodedData = MintLayout.decode(accountData);

    return {
      mintAuthority:
        decodedData.mintAuthorityOption === 1
          ? new PublicKey(decodedData.mintAuthority)
          : null,
      supply: u64.fromBuffer(decodedData.supply),
      decimals: decodedData.decimals,
      isInitialized: decodedData.isInitialized,
      freezeAuthority:
        decodedData.freezeAuthorityOption === 1
          ? new PublicKey(decodedData.freezeAuthority)
          : null,
    };
  }

  static async scaleAmount(
    amount: u64 | number | string,
    token: Token
  ): Promise<u64> {
    const mintInfo = await token.getMintInfo();
    return new u64(
      new u64(amount.toString())
        .mul(new u64(10).pow(new u64(mintInfo.decimals)))
        .toString()
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
      batchInput.map(([amount, token]) => TokenUtil.scaleAmount(amount, token))
    );
  }
}
