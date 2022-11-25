import { TestUtil } from "./config.util";
import { CurveType, TokenSwap } from "@solana/spl-token-swap";
import { Keypair, PublicKey, Account } from "@solana/web3.js";
import { ProgramUtil } from "./program.util";
import {
  amount,
  Denom,
  generatePair,
  getSwapAuthorityPDA,
} from "./common.util";
import { Token } from "@solana/spl-token";
import { SolUtil } from "./sol.util";
import { TokenUtil } from "./token.util";
import { BN } from "@project-serum/anchor";

export type DeployTokenSwapRes = {
  tokenSwapKeypair: Keypair;
  tokenOwnerKeypair: Keypair;
  tokenA: Token;
  tokenB: Token;
  tokenSwap: TokenSwap;
};
export class TokenSwapUtil extends TestUtil {
  static async deployTokenSwap({
    tokenSwapKeypair = generatePair(),
    tokenOwnerKeypair = generatePair(),
    tokenA,
    tokenB,
    poolAAmount,
    poolBAmount,
  }: {
    tokenSwapKeypair?: Keypair;
    tokenOwnerKeypair?: Keypair;
    tokenA?: Token;
    tokenB?: Token;
    poolAAmount?: BN;
    poolBAmount?: BN;
  }): Promise<DeployTokenSwapRes> {
    await Promise.all([
      await SolUtil.fundAccount(
        tokenOwnerKeypair.publicKey,
        SolUtil.solToLamports(0.2)
      ),
    ]);
    if (!tokenA) {
      tokenA = await TokenUtil.createMint(tokenOwnerKeypair.publicKey, null, 6);
    }
    if (!tokenB) {
      tokenB = await TokenUtil.createMint(tokenOwnerKeypair.publicKey, null, 6);
    }
    if (!poolAAmount) {
      poolAAmount = await TokenUtil.scaleAmount(
        amount(10, Denom.Million),
        tokenA
      );
    }
    if (!poolBAmount) {
      poolBAmount = await TokenUtil.scaleAmount(
        amount(10, Denom.Million),
        tokenB
      );
    }
    const { publicKey: swapAuthority, bump: swapAuthorityBump } =
      await getSwapAuthorityPDA(tokenSwapKeypair.publicKey);
    const swapLPToken = await TokenUtil.createMint(
      swapAuthority,
      null,
      2,
      tokenOwnerKeypair
    );

    const [
      swapLPTokenAccount,
      swapLPTokenFeeAccount,
      swapTokenAAccount,
      swapTokenBAccount,
    ] = await Promise.all([
      swapLPToken.createAccount(tokenOwnerKeypair.publicKey),
      swapLPToken.createAccount(
        new PublicKey("HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN")
      ),
      tokenA.createAccount(swapAuthority),
      tokenB.createAccount(swapAuthority),
    ]);
    await Promise.all([
      tokenA.mintTo(swapTokenAAccount, tokenOwnerKeypair, [], poolAAmount),
      tokenB.mintTo(swapTokenBAccount, tokenOwnerKeypair, [], poolBAmount),
    ]);

    const tokenSwap = await TokenSwap.createTokenSwap(
      this.provider.connection,
      new Account(tokenOwnerKeypair.secretKey),
      new Account(tokenSwapKeypair.secretKey),
      swapAuthority,
      swapTokenAAccount,
      swapTokenBAccount,
      swapLPToken.publicKey,
      tokenA.publicKey,
      tokenB.publicKey,
      swapLPTokenFeeAccount,
      swapLPTokenAccount,
      ProgramUtil.tokenSwapProgram.programId,
      ProgramUtil.tokenProgram.programId,
      swapAuthorityBump,
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
    const res: DeployTokenSwapRes = {
      tokenA,
      tokenB,
      tokenOwnerKeypair,
      tokenSwapKeypair,
      tokenSwap,
    };
    return res;
  }
}
