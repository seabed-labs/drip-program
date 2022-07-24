import { TestUtil } from "./config.util";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  increaseLiquidityIx,
  initializeConfigIx,
  initializeFeeTierIx,
  initializePoolIx,
  initTickArrayIx,
  openPositionIx,
} from "@orca-so/whirlpools-sdk/dist/instructions";
import {
  PDAUtil,
  PoolUtil,
  PriceMath,
  TICK_ARRAY_SIZE,
  TickUtil,
  toTx,
  WhirlpoolContext,
} from "@orca-so/whirlpools-sdk";
import { BN } from "@project-serum/anchor";
import { ProgramUtil } from "./program.util";
import { Token, u64 } from "@solana/spl-token";
import { TokenUtil } from "./token.util";

const defaultInitSqrtPrice = PriceMath.tickIndexToSqrtPriceX64(27500);
const defaultTickSpacing = 8;

export type InitWhirlpoolConfigRes = {
  config: PublicKey;
  feeTier: PublicKey;
  tickSpacing: number;
  txId: string;
};

export type InitWhirlpoolRes = {
  whirlpool: PublicKey;
  initSqrtPrice: BN;
  tickSpacing: number;
  tokenVaultAKeypair: Keypair;
  tokenVaultBKeypair: Keypair;
  txId: string;
};

export type OpenPositionRes = {
  positionMint: PublicKey;
  position: PublicKey;
  positionTokenAccount: PublicKey;
  txId: string;
};

export type InitTickArrayRes = {
  tickArray: PublicKey;
  txId: string;
};

export type FundedPositionParams = {
  liquidityAmount: u64;
  tickLowerIndex: number;
  tickUpperIndex: number;
};

export type FundedPositionRes = {
  publicKey: PublicKey;
  tokenAccount: PublicKey;
  mint: PublicKey;
  tickArrayLower: PublicKey;
  tickArrayUpper: PublicKey;
};

export class WhirlpoolUtil extends TestUtil {
  static get whirlpoolCtx(): WhirlpoolContext {
    return WhirlpoolContext.withProvider(
      this.provider,
      ProgramUtil.orcaWhirlpoolProgram.programId
    );
  }

  static async initConfig(
    whirlpoolsConfigKeypair: Keypair,
    feeAuthorityKeypair: Keypair,
    collectProtocolFeesAuthority: PublicKey,
    rewardEmissionsSuperAuthority: PublicKey,
    {
      defaultProtocolFeeRate = 300,
      tickSpacing = defaultTickSpacing,
    }: {
      defaultProtocolFeeRate?: number;
      tickSpacing?: number;
    }
  ): Promise<InitWhirlpoolConfigRes> {
    const ctx = this.whirlpoolCtx;

    const initConfigIx = initializeConfigIx(ctx.program, {
      whirlpoolsConfigKeypair,
      feeAuthority: feeAuthorityKeypair.publicKey,
      collectProtocolFeesAuthority,
      rewardEmissionsSuperAuthority,
      defaultProtocolFeeRate,
      funder: this.provider.wallet.publicKey,
    });
    const feeTierPda = PDAUtil.getFeeTier(
      ctx.program.programId,
      whirlpoolsConfigKeypair.publicKey,
      tickSpacing
    );
    const initFeeTierIx = initializeFeeTierIx(ctx.program, {
      whirlpoolsConfig: whirlpoolsConfigKeypair.publicKey,
      feeTierPda,
      tickSpacing,
      defaultFeeRate: defaultProtocolFeeRate,
      feeAuthority: feeAuthorityKeypair.publicKey,
      funder: this.provider.wallet.publicKey,
    });
    return {
      config: whirlpoolsConfigKeypair.publicKey,
      feeTier: feeTierPda.publicKey,
      tickSpacing: tickSpacing,
      txId: await toTx(ctx, initConfigIx)
        .addInstruction(initFeeTierIx)
        .addSigner(feeAuthorityKeypair)
        .buildAndExecute(),
    };
  }

  static async initPool(
    whirlpoolsConfig: PublicKey,
    feeTierKey: PublicKey,
    tokenMintA: PublicKey,
    tokenMintB: PublicKey,
    tickSpacing: number,
    {
      initSqrtPrice = defaultInitSqrtPrice,
      tokenVaultAKeypair = Keypair.generate(),
      tokenVaultBKeypair = Keypair.generate(),
    }: {
      tickSpacing?: number;
      initSqrtPrice?: BN;
      tokenVaultAKeypair?: Keypair;
      tokenVaultBKeypair?: Keypair;
    }
  ): Promise<InitWhirlpoolRes> {
    const ctx = this.whirlpoolCtx;

    const whirlpoolPda = PDAUtil.getWhirlpool(
      ctx.program.programId,
      whirlpoolsConfig,
      tokenMintA,
      tokenMintB,
      tickSpacing
    );
    const initPoolIx = initializePoolIx(ctx.program, {
      initSqrtPrice,
      whirlpoolsConfig,
      whirlpoolPda,
      tokenMintA,
      tokenMintB,
      tokenVaultAKeypair,
      tokenVaultBKeypair,
      feeTierKey,
      tickSpacing,
      funder: this.provider.wallet.publicKey,
    });

    return {
      whirlpool: whirlpoolPda.publicKey,
      initSqrtPrice,
      tickSpacing,
      tokenVaultAKeypair,
      tokenVaultBKeypair,
      txId: await toTx(ctx, initPoolIx).buildAndExecute(),
    };
  }

  static async initTickArray(
    whirlpool: PublicKey,
    startTick: number
  ): Promise<InitTickArrayRes> {
    const ctx = this.whirlpoolCtx;
    const tickArrayPda = PDAUtil.getTickArray(
      ctx.program.programId,
      whirlpool,
      startTick
    );
    const tx = toTx(
      ctx,
      initTickArrayIx(ctx.program, {
        whirlpool,
        tickArrayPda,
        startTick,
        funder: this.provider.wallet.publicKey,
      })
    );

    return {
      tickArray: tickArrayPda.publicKey,
      txId: await tx.buildAndExecute(),
    };
  }

  private static async openPosition(
    whirlpool: PublicKey,
    tickLowerIndex: number,
    tickUpperIndex: number
  ): Promise<OpenPositionRes> {
    const ctx = this.whirlpoolCtx;

    const positionMintKeypair = Keypair.generate();
    const positionPda = PDAUtil.getPosition(
      ctx.program.programId,
      positionMintKeypair.publicKey
    );

    const positionTokenAccountAddress = await Token.getAssociatedTokenAddress(
      ProgramUtil.associatedTokenProgram.programId,
      ProgramUtil.tokenProgram.programId,
      positionMintKeypair.publicKey,
      this.provider.wallet.publicKey
    );

    let tx = toTx(
      ctx,
      openPositionIx(ctx.program, {
        whirlpool,
        owner: this.provider.wallet.publicKey,
        positionPda,
        positionMintAddress: positionMintKeypair.publicKey,
        positionTokenAccount: positionTokenAccountAddress,
        tickLowerIndex,
        tickUpperIndex,
        funder: this.provider.wallet.publicKey,
      })
    );
    tx.addSigner(positionMintKeypair);
    const txId = await tx.buildAndExecute();
    return {
      positionMint: positionMintKeypair.publicKey,
      position: positionPda.publicKey,
      positionTokenAccount: positionTokenAccountAddress,
      txId,
    };
  }

  static async fundPositions(
    whirlpool: PublicKey,
    tokenAccountA: PublicKey,
    tokenAccountB: PublicKey,
    tokenVaultAKeypair: Keypair,
    tokenVaultBKeypair: Keypair,
    tickSpacing: number,
    initSqrtPrice: BN,
    fundParams: FundedPositionParams[]
  ): Promise<FundedPositionRes[]> {
    const ctx = this.whirlpoolCtx;
    return await Promise.all(
      fundParams.map(async (param): Promise<FundedPositionRes> => {
        const openPositionRes = await WhirlpoolUtil.openPosition(
          whirlpool,
          param.tickLowerIndex,
          param.tickUpperIndex
        );

        const tickArrayLower = PDAUtil.getTickArray(
          ctx.program.programId,
          whirlpool,
          TickUtil.getStartTickIndex(param.tickLowerIndex, tickSpacing)
        ).publicKey;

        const tickArrayUpper = PDAUtil.getTickArray(
          ctx.program.programId,
          whirlpool,
          TickUtil.getStartTickIndex(param.tickUpperIndex, tickSpacing)
        ).publicKey;

        if (param.liquidityAmount.gt(new BN(0))) {
          const { tokenA, tokenB } = PoolUtil.getTokenAmountsFromLiquidity(
            param.liquidityAmount,
            initSqrtPrice,
            PriceMath.tickIndexToSqrtPriceX64(param.tickLowerIndex),
            PriceMath.tickIndexToSqrtPriceX64(param.tickUpperIndex),
            true
          );
          await toTx(
            ctx,
            increaseLiquidityIx(ctx.program, {
              liquidityAmount: param.liquidityAmount,
              tokenMaxA: tokenA,
              tokenMaxB: tokenB,
              whirlpool: whirlpool,
              positionAuthority: ctx.provider.wallet.publicKey,
              position: openPositionRes.position,
              positionTokenAccount: openPositionRes.positionTokenAccount,
              tokenOwnerAccountA: tokenAccountA,
              tokenOwnerAccountB: tokenAccountB,
              tokenVaultA: tokenVaultAKeypair.publicKey,
              tokenVaultB: tokenVaultBKeypair.publicKey,
              tickArrayLower,
              tickArrayUpper,
            })
          ).buildAndExecute();
        }
        return {
          publicKey: openPositionRes.position,
          tokenAccount: openPositionRes.positionTokenAccount,
          mint: openPositionRes.positionMint,
          tickArrayLower,
          tickArrayUpper,
        };
      })
    );
  }

  static async initTickArrayRange(
    whirlpool: PublicKey,
    startTickIndex: number,
    arrayCount: number,
    aToB: boolean,
    tickSpacing: number = defaultTickSpacing
  ): Promise<PublicKey[]> {
    const ticksInArray = tickSpacing * TICK_ARRAY_SIZE;
    const direction = aToB ? -1 : 1;
    const result: PublicKey[] = [];

    for (let i = 0; i < arrayCount; i++) {
      const initTickArrayRes = await WhirlpoolUtil.initTickArray(
        whirlpool,
        startTickIndex + direction * ticksInArray * i
      );
      result.push(initTickArrayRes.tickArray);
    }

    return result;
  }

  static async getOrderedMints({
    tokenAMint,
    tokenBMint,
    tokenOwnerKeypair,
  }:
    | {
        tokenAMint: Token;
        tokenBMint: Token;
        tokenOwnerKeypair?: Keypair;
      }
    | {
        tokenAMint?: Token;
        tokenBMint?: Token;
        tokenOwnerKeypair: Keypair;
      }): Promise<Token[]> {
    if (!tokenAMint) {
      tokenAMint = await TokenUtil.createMint(
        tokenOwnerKeypair.publicKey,
        null,
        6
      );
    }
    if (!tokenBMint) {
      tokenBMint = await TokenUtil.createMint(
        tokenOwnerKeypair.publicKey,
        null,
        6
      );
    }
    if (
      Buffer.compare(
        tokenAMint.publicKey.toBuffer(),
        tokenBMint.publicKey.toBuffer()
      ) < 0
    ) {
      return [tokenAMint, tokenBMint];
    } else {
      return [tokenBMint, tokenAMint];
    }
  }
}
