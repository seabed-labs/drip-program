import { TestUtil } from "./config.util";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
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
  buildWhirlpoolClient,
} from "@orca-so/whirlpools-sdk";
import { BN } from "@coral-xyz/anchor";
import { ProgramUtil } from "./program.util";
import { TokenUtil } from "./token.util";
import {
  amount,
  Denom,
  findAssociatedTokenAddress,
  generatePair,
} from "./common.util";
import { SolUtil } from "./sol.util";
import { Mint } from "@solana/spl-token";

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
  tokenMintA: PublicKey;
  tokenMintB: PublicKey;
  oracle: PublicKey;
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
  liquidityAmount: bigint;
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

export type DeployWhirlpoolRes = {
  initWhirlpoolConfigRes: InitWhirlpoolConfigRes;
  initWhirlpoolRes: InitWhirlpoolRes;
  positions: FundedPositionRes[];
  whirlpoolKeypair: Keypair;
  whirlpoolAuth: Keypair;
  tokenOwnerKeypair: Keypair;
  tokenA: Mint;
  tokenB: Mint;
};
export class WhirlpoolUtil extends TestUtil {
  static get whirlpoolCtx(): WhirlpoolContext {
    return WhirlpoolContext.withProvider(
      this.provider,
      ProgramUtil.orcaWhirlpoolProgram.programId,
    );
  }

  // Program Wrappers

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
    },
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
      tickSpacing,
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
    },
  ): Promise<InitWhirlpoolRes> {
    const ctx = this.whirlpoolCtx;

    const whirlpoolPda = PDAUtil.getWhirlpool(
      ctx.program.programId,
      whirlpoolsConfig,
      tokenMintA,
      tokenMintB,
      tickSpacing,
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
    const oracle = PDAUtil.getOracle(
      ProgramUtil.orcaWhirlpoolProgram.programId,
      whirlpoolPda.publicKey,
    ).publicKey;
    return {
      whirlpool: whirlpoolPda.publicKey,
      initSqrtPrice,
      tickSpacing,
      tokenVaultAKeypair,
      tokenVaultBKeypair,
      tokenMintA,
      tokenMintB,
      oracle,
      txId: await toTx(ctx, initPoolIx).buildAndExecute(),
    };
  }

  static async initTickArray(
    whirlpool: PublicKey,
    startTick: number,
  ): Promise<InitTickArrayRes> {
    const ctx = this.whirlpoolCtx;
    const tickArrayPda = PDAUtil.getTickArray(
      ctx.program.programId,
      whirlpool,
      startTick,
    );

    const tx = toTx(
      ctx,
      initTickArrayIx(ctx.program, {
        whirlpool,
        tickArrayPda,
        startTick,
        funder: this.provider.wallet.publicKey,
      }),
    );

    return {
      tickArray: tickArrayPda.publicKey,
      txId: await tx.buildAndExecute(),
    };
  }

  private static async openPosition(
    whirlpool: PublicKey,
    tickLowerIndex: number,
    tickUpperIndex: number,
  ): Promise<OpenPositionRes> {
    const ctx = this.whirlpoolCtx;

    const positionMintKeypair = Keypair.generate();
    const positionPda = PDAUtil.getPosition(
      ctx.program.programId,
      positionMintKeypair.publicKey,
    );

    const positionTokenAccountAddress = await findAssociatedTokenAddress(
      this.provider.wallet.publicKey,
      positionMintKeypair.publicKey,
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
      }),
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
    fundParams: FundedPositionParams[],
  ): Promise<FundedPositionRes[]> {
    const ctx = this.whirlpoolCtx;
    const fetcher = WhirlpoolUtil.whirlpoolCtx.fetcher;
    return await Promise.all(
      fundParams.map(async (param): Promise<FundedPositionRes> => {
        const openPositionRes = await WhirlpoolUtil.openPosition(
          whirlpool,
          param.tickLowerIndex,
          param.tickUpperIndex,
        );

        const lowerTick = TickUtil.getStartTickIndex(
          param.tickLowerIndex,
          tickSpacing,
        );
        const tickArrayLower = PDAUtil.getTickArray(
          ctx.program.programId,
          whirlpool,
          lowerTick,
        ).publicKey;
        const tickArrayLowerData = await fetcher.getTickArray(tickArrayLower);

        const upperTick = TickUtil.getStartTickIndex(
          param.tickUpperIndex,
          tickSpacing,
        );
        const tickArrayUpper = PDAUtil.getTickArray(
          ctx.program.programId,
          whirlpool,
          upperTick,
        ).publicKey;
        const tickArrayUpperData = await fetcher.getTickArray(tickArrayLower);

        if (param.liquidityAmount < BigInt(0)) {
          const { tokenA, tokenB } = PoolUtil.getTokenAmountsFromLiquidity(
            param.liquidityAmount,
            initSqrtPrice,
            PriceMath.tickIndexToSqrtPriceX64(param.tickLowerIndex),
            PriceMath.tickIndexToSqrtPriceX64(param.tickUpperIndex),
            true,
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
            }),
          ).buildAndExecute();
        }

        return {
          publicKey: openPositionRes.position,
          tokenAccount: openPositionRes.positionTokenAccount,
          mint: openPositionRes.positionMint,
          tickArrayLower,
          tickArrayUpper,
        };
      }),
    );
  }

  // Helpers

  static async initTickArrayRange(
    whirlpool: PublicKey,
    startTickIndex: number,
    arrayCount: number,
    aToB: boolean,
    tickSpacing: number,
  ): Promise<PublicKey[]> {
    const ticksInArray = tickSpacing * TICK_ARRAY_SIZE;
    const direction = aToB ? -1 : 1;
    const result: PublicKey[] = [];

    for (let i = 0; i < arrayCount; i++) {
      try {
        let tickIndex = startTickIndex + direction * ticksInArray * i;
        tickIndex = TickUtil.getStartTickIndex(tickIndex, tickSpacing);
        const initTickArrayRes = await WhirlpoolUtil.initTickArray(
          whirlpool,
          tickIndex,
        );
        result.push(initTickArrayRes.tickArray);
      } catch (e) {
        // console.log(e);
      }
    }

    return result;
  }

  static async getOrderedMints({
    tokenAMint,
    tokenBMint,
    tokenOwnerKeypair,
  }:
    | {
        tokenAMint: Mint;
        tokenBMint: Mint;
        tokenOwnerKeypair?: Keypair;
      }
    | {
        tokenAMint?: Mint;
        tokenBMint?: Mint;
        tokenOwnerKeypair: Keypair;
      }): Promise<Mint[]> {
    if (!tokenAMint) {
      tokenAMint = await TokenUtil.createMint(
        tokenOwnerKeypair.publicKey,
        null,
        6,
      );
    }
    if (!tokenBMint) {
      tokenBMint = await TokenUtil.createMint(
        tokenOwnerKeypair.publicKey,
        null,
        6,
      );
    }
    if (
      Buffer.compare(
        tokenAMint.address.toBuffer(),
        tokenBMint.address.toBuffer(),
      ) < 0
    ) {
      return [tokenAMint, tokenBMint];
    } else {
      return [tokenBMint, tokenAMint];
    }
  }

  // TODO(Mocha): this technically does not need to be in the static class
  static async deployWhirlpool({
    whirlpoolKeypair = generatePair(),
    whirlpoolAuth = generatePair(),
    tokenOwnerKeypair = generatePair(),
    tokenA,
    tokenB,
    initSqrtPrice = PriceMath.tickIndexToSqrtPriceX64(99040),
  }: {
    whirlpoolKeypair?: Keypair;
    whirlpoolAuth?: Keypair;
    tokenOwnerKeypair?: Keypair;
    tokenA?: Mint;
    tokenB?: Mint;
    initSqrtPrice?: BN;
  }): Promise<DeployWhirlpoolRes> {
    [tokenA, tokenB] = await WhirlpoolUtil.getOrderedMints({
      tokenAMint: tokenA,
      tokenBMint: tokenB,
      tokenOwnerKeypair,
    });
    await Promise.all([
      SolUtil.fundAccount(
        tokenOwnerKeypair.publicKey,
        SolUtil.solToLamports(0.1),
      ),
    ]);

    const initWhirlpoolConfigRes = await WhirlpoolUtil.initConfig(
      whirlpoolKeypair,
      whirlpoolAuth,
      whirlpoolAuth.publicKey,
      whirlpoolAuth.publicKey,
      {},
    );

    const initWhirlpoolRes = await WhirlpoolUtil.initPool(
      initWhirlpoolConfigRes.config,
      initWhirlpoolConfigRes.feeTier,
      tokenA.address,
      tokenB.address,
      initWhirlpoolConfigRes.tickSpacing,
      {
        initSqrtPrice,
      },
    );
    const whirlpoolClient = buildWhirlpoolClient(WhirlpoolUtil.whirlpoolCtx);
    const whirlpool = await whirlpoolClient.getPool(initWhirlpoolRes.whirlpool);
    const startIndex = whirlpool.getData().tickCurrentIndex;
    // Based off of swap.test.ts swaps across three tick arrays
    await WhirlpoolUtil.initTickArrayRange(
      initWhirlpoolRes.whirlpool,
      startIndex,
      10,
      true,
      initWhirlpoolConfigRes.tickSpacing,
    );
    // Based off of swap.test.ts swaps across three tick arrays
    await WhirlpoolUtil.initTickArrayRange(
      initWhirlpoolRes.whirlpool,
      startIndex,
      10,
      false,
      initWhirlpoolConfigRes.tickSpacing,
    );

    // Token A -> USDC

    const tokenAAccount = await TokenUtil.createTokenAccount(
      tokenA,
      TestUtil.provider.wallet.publicKey,
      tokenOwnerKeypair,
    );
    const mintAmountA = TokenUtil.scaleAmount(
      amount(1e4, Denom.Billion),
      tokenA,
    );
    await TokenUtil.mintTo({
      payer: tokenOwnerKeypair,
      token: tokenA,
      mintAuthority: tokenOwnerKeypair,
      recipient: tokenAAccount,
      amount: mintAmountA,
    });

    // Token B -> SOL

    const tokenBAccount = await TokenUtil.createTokenAccount(
      tokenB,
      TestUtil.provider.wallet.publicKey,
      tokenOwnerKeypair,
    );
    const mintAmountB = TokenUtil.scaleAmount(
      amount(1e4, Denom.Billion),
      tokenB,
    );
    await TokenUtil.mintTo({
      payer: tokenOwnerKeypair,
      token: tokenB,
      mintAuthority: tokenOwnerKeypair,
      recipient: tokenBAccount,
      amount: mintAmountB,
    });

    // Based off of swap.test.ts swaps across three tick arrays
    const fundParams: FundedPositionParams[] = [
      {
        liquidityAmount: BigInt("100000000000000000"),
        tickLowerIndex:
          startIndex - initWhirlpoolConfigRes.tickSpacing * TICK_ARRAY_SIZE * 1,
        tickUpperIndex:
          startIndex + initWhirlpoolConfigRes.tickSpacing * TICK_ARRAY_SIZE * 1,
      },
      {
        liquidityAmount: BigInt("100000000000000000"),
        tickLowerIndex:
          startIndex - initWhirlpoolConfigRes.tickSpacing * TICK_ARRAY_SIZE * 2,
        tickUpperIndex:
          startIndex + initWhirlpoolConfigRes.tickSpacing * TICK_ARRAY_SIZE * 2,
      },
      {
        liquidityAmount: BigInt("100000000000000000"),
        tickLowerIndex:
          startIndex - initWhirlpoolConfigRes.tickSpacing * TICK_ARRAY_SIZE * 3,
        tickUpperIndex:
          startIndex + initWhirlpoolConfigRes.tickSpacing * TICK_ARRAY_SIZE * 3,
      },
    ];

    const positions = await WhirlpoolUtil.fundPositions(
      initWhirlpoolRes.whirlpool,
      tokenAAccount,
      tokenBAccount,
      initWhirlpoolRes.tokenVaultAKeypair,
      initWhirlpoolRes.tokenVaultBKeypair,
      initWhirlpoolConfigRes.tickSpacing,
      initWhirlpoolRes.initSqrtPrice,
      fundParams,
    );

    return {
      initWhirlpoolConfigRes,
      initWhirlpoolRes,
      positions,
      tokenOwnerKeypair,
      whirlpoolKeypair,
      whirlpoolAuth,
      tokenA,
      tokenB,
    };
  }
}
