import { TestUtil } from "./config";
import { CurveType, TokenSwap } from "@solana/spl-token-swap";
import { Keypair, PublicKey, Account } from "@solana/web3.js";
import { PDA } from "./PDAUtils";
import { ProgramUtils } from "./ProgramUtils";

export class SwapUtils extends TestUtil {
  static async createSwap(
    payer: Keypair,
    tokenSwapKeypair: Keypair,
    swapAuthorityPDA: PDA,
    tokenAMint: PublicKey,
    tokenBMint: PublicKey,
    swapTokenAAccount: PublicKey,
    swapTokenBAccount: PublicKey,
    poolTokenMint: PublicKey,
    poolTokenFeeAccount: PublicKey,
    swapPoolTokenAccount: PublicKey
  ): Promise<TokenSwap> {
    return await TokenSwap.createTokenSwap(
      this.provider.connection,
      new Account(payer.secretKey),
      new Account(tokenSwapKeypair.secretKey),
      swapAuthorityPDA.publicKey,
      swapTokenAAccount,
      swapTokenBAccount,
      poolTokenMint,
      tokenAMint,
      tokenBMint,
      poolTokenFeeAccount,
      swapPoolTokenAccount,
      ProgramUtils.tokenSwapProgram.programId,
      ProgramUtils.tokenProgram.programId,
      swapAuthorityPDA.bump,
      0,
      10000,
      5,
      10000,
      0,
      0,
      20,
      100,
      CurveType.ConstantProduct
    );
  }
}
