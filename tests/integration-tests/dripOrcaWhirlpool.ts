import {
  FundedPositionParams,
  InitWhirlpoolConfigRes,
  InitWhirlpoolRes,
  WhirlpoolUtil,
} from "../utils/whirlpool.util";
import { amount, Denom, generatePairs } from "../utils/common.util";
import { Keypair, PublicKey } from "@solana/web3.js";
import { TokenUtil } from "../utils/token.util";
import { Token, u64 } from "@solana/spl-token";
import { TestUtil } from "../utils/config.util";
import { SolUtil } from "../utils/sol.util";

describe("#dripOrcaWhirlpool", testDripOrcaWhirlpool);

export function testDripOrcaWhirlpool() {
  let tokenOwnerKeypair: Keypair;
  let whirlpoolKeypair: Keypair;
  let whirlpoolAuth: Keypair;

  let tokenA: Token;
  let tokenB: Token;

  let initWhirlpoolConfigRes: InitWhirlpoolConfigRes;
  let initWhirlpoolRes: InitWhirlpoolRes;
  let tickArrays: PublicKey[];

  beforeEach(async () => {
    [tokenOwnerKeypair, whirlpoolKeypair, whirlpoolAuth] = generatePairs(3);
    await Promise.all([
      SolUtil.fundAccount(
        tokenOwnerKeypair.publicKey,
        SolUtil.solToLamports(0.1)
      ),
    ]);

    [tokenA, tokenB] = await WhirlpoolUtil.getOrderedMints({
      tokenOwnerKeypair,
    });

    initWhirlpoolConfigRes = await WhirlpoolUtil.initConfig(
      whirlpoolKeypair,
      whirlpoolAuth,
      whirlpoolAuth.publicKey,
      whirlpoolAuth.publicKey,
      {}
    );
    // console.log(JSON.stringify(initWhirlpoolConfigRes, undefined, 2))

    initWhirlpoolRes = await WhirlpoolUtil.initPool(
      initWhirlpoolConfigRes.config,
      initWhirlpoolConfigRes.feeTier,
      tokenA.publicKey,
      tokenB.publicKey,
      initWhirlpoolConfigRes.tickSpacing,
      {}
    );

    // Based off of swap.test.ts swaps across three tick arrays
    tickArrays = await WhirlpoolUtil.initTickArrayRange(
      initWhirlpoolRes.whirlpool,
      27456,
      5,
      false
    );

    // Token A -> USDC
    const tokenAAccount = await tokenA.createAccount(
      TestUtil.provider.wallet.publicKey
    );
    const mintAmountA = await TokenUtil.scaleAmount(
      amount(40, Denom.Million),
      tokenA
    );
    await tokenA.mintTo(tokenAAccount, tokenOwnerKeypair, [], mintAmountA);

    // Token B -> SOL
    const tokenBAccount = await tokenB.createAccount(
      TestUtil.provider.wallet.publicKey
    );
    const mintAmountB = await TokenUtil.scaleAmount(
      amount(1, Denom.Million),
      tokenB
    );
    await tokenB.mintTo(tokenBAccount, tokenOwnerKeypair, [], mintAmountB);

    // Based off of swap.test.ts swaps across three tick arrays
    const fundParams: FundedPositionParams[] = [
      {
        liquidityAmount: new u64(100_000_000),
        tickLowerIndex: 27456,
        tickUpperIndex: 27840,
      },
      {
        liquidityAmount: new u64(100_000_000),
        tickLowerIndex: 28864,
        tickUpperIndex: 28928,
      },
      {
        liquidityAmount: new u64(100_000_000),
        tickLowerIndex: 27712,
        tickUpperIndex: 28928,
      },
    ];

    const fundedPositionRes = await WhirlpoolUtil.fundPositions(
      initWhirlpoolRes.whirlpool,
      tokenAAccount,
      tokenBAccount,
      initWhirlpoolRes.tokenVaultAKeypair,
      initWhirlpoolRes.tokenVaultBKeypair,
      initWhirlpoolConfigRes.tickSpacing,
      initWhirlpoolRes.initSqrtPrice,
      fundParams
    );
    // console.log(JSON.stringify(fundedPositionRes, undefined, 2));
  });

  it("should drip twice with expected TWAP and balance values", async () => {});

  it("should drip with inverted swap (b to a)", async () => {});

  it("should drip dca_cyles number of times", async () => {});

  it("should fail to drip if a non-whitelisted swaps is provided", async () => {});

  // The tests below are generic for any drip_xxx instruction variant
  // But we can't really generalize them because each drip_xxx variant has a different
  // interface

  it("should fail to drip if vault token A balance is less than vault.dripAmount", async () => {});

  it("should fail to drip if vaultProtoConfig does not match vault.protoConfig", async () => {});

  it("should fail to drip if lastVaultPeriod.vault does not match vault", async () => {});

  it("should fail to drip if lastVaultPeriod.periodId does not match vault.lastDcaPeriod", async () => {});

  it("should fail to drip if currentVaultPeriod.vault does not match vault", async () => {});

  it("should fail to drip if currentVaultPeriod.period_id does not match vault.lastDcaPeriod + 1", async () => {});

  it("should fail to drip if currentVaultPeriod.period_id does not match vault.lastDcaPeriod + 1", async () => {});

  it("should fail to drip if vaultTokenAAccount.authority does not match vault", async () => {});

  it("should fail to drip if vaultTokenBAccount.authority does not match vault", async () => {});

  it("should fail to drip if we drip twice in the same granularity", async () => {});

  it("should fail to drip if user does not delegate token A balance", async () => {});
}
