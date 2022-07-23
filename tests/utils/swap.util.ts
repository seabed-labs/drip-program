import { TestUtil } from "./config.util";
import { CurveType, TokenSwap } from "@solana/spl-token-swap";
import { Keypair, PublicKey, Account } from "@solana/web3.js";
import { ProgramUtil } from "./program.util";
import { PDA } from "./common.util";

export class SwapUtil extends TestUtil {
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
      ProgramUtil.tokenSwapProgram.programId,
      ProgramUtil.tokenProgram.programId,
      swapAuthorityPDA.bump,
      25, // must be non-zero
      10000, // must be non-zero
      5, // must be non-zero
      10000, // must be non-zero
      0,
      0,
      20, // must be non-zero
      100, // must be non-zero
      CurveType.ConstantProduct
    );
  }
}
