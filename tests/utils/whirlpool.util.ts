import { TestUtil } from "./config.util";
import { Keypair, PublicKey, TransactionSignature } from "@solana/web3.js";
import {
  initializeConfigIx,
  initializeFeeTierIx,
  initializePoolIx,
} from "@orca-so/whirlpools-sdk/dist/instructions";
import { PDAUtil, toTx, WhirlpoolContext } from "@orca-so/whirlpools-sdk";
import { BN } from "@project-serum/anchor";

// const defaultInitSqrtPrice = MathUtil.toX64_BN(new u64(5));

export class WhirlpoolUtil extends TestUtil {
  static get whirlpoolCtx(): WhirlpoolContext {
    const program = anchor.workspace.Whirlpool;
    // @ts-ignore
    return WhirlpoolContext.fromWorkspace(this.provider, program);
  }

  static async initConfig(
    whirlpoolsConfigKeypair: Keypair,
    feeAuthority: PublicKey,
    collectProtocolFeesAuthority: PublicKey,
    rewardEmissionsSuperAuthority: PublicKey,
    defaultProtocolFeeRate: number,
    tickSpacing: number = 0,
    funder?: PublicKey
  ): Promise<TransactionSignature> {
    const ctx = this.whirlpoolCtx;
    if (!funder) {
      funder = this.provider.wallet.publicKey;
    }
    // TODO(Mocha): pass this in

    const initConfigIx = initializeConfigIx(ctx.program, {
      whirlpoolsConfigKeypair,
      feeAuthority,
      collectProtocolFeesAuthority,
      rewardEmissionsSuperAuthority,
      defaultProtocolFeeRate,
      funder,
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
      feeAuthority: collectProtocolFeesAuthority,
      funder: funder,
    });
    return toTx(ctx, initConfigIx)
      .addInstruction(initFeeTierIx)
      .buildAndExecute();
  }

  static async initPool(
    whirlpoolsConfig: PublicKey,
    feeTierKey: PublicKey,
    tokenMintA: PublicKey,
    tokenMintB: PublicKey,
    tokenVaultAKeypair: Keypair = Keypair.generate(),
    tokenVaultBKeypair: Keypair = Keypair.generate(),
    initSqrtPrice: number = 0,
    tickSpacing: number = 0,
    funder?: PublicKey
  ): Promise<TransactionSignature> {
    if (!funder) {
      funder = this.provider.wallet.publicKey;
    }
    const ctx = this.whirlpoolCtx;

    const whirlpoolPda = PDAUtil.getWhirlpool(
      ctx.program.programId,
      whirlpoolsConfig,
      tokenMintA,
      tokenMintB,
      tickSpacing
    );
    const initPoolIx = initializePoolIx(ctx.program, {
      initSqrtPrice: new BN(0),
      whirlpoolsConfig,
      whirlpoolPda,
      tokenMintA,
      tokenMintB,
      tokenVaultAKeypair,
      tokenVaultBKeypair,
      feeTierKey,
      tickSpacing,
      funder: funder,
    });

    return toTx(ctx, initPoolIx).buildAndExecute();
  }
}
