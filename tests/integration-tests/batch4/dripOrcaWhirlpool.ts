import "should";
import { DeployWhirlpoolRes, WhirlpoolUtil } from "../../utils/whirlpool.util";
import { TokenUtil } from "../../utils/token.util";
import { dripOrcaWhirlpoolWrapper } from "../../utils/setup.util";
import { DeployVaultRes, VaultUtil } from "../../utils/vault.util";
import { AccountUtil } from "../../utils/account.util";
import {
  AccountFetcher,
  buildWhirlpoolClient,
  swapQuoteByInputToken,
} from "@orca-so/whirlpools-sdk";
import { ProgramUtil } from "../../utils/program.util";
import { Percentage } from "@orca-so/common-sdk";

describe("#dripOrcaWhirlpool", testDripOrcaWhirlpool);

export function testDripOrcaWhirlpool() {
  let deployWhirlpoolRes: DeployWhirlpoolRes;
  let deployNonWhitelistedWhirlpoolRes: DeployWhirlpoolRes;
  let deployVaultRes: DeployVaultRes;

  let dripTrigger;
  let fetcher;
  before(async () => {
    deployWhirlpoolRes = await WhirlpoolUtil.deployWhirlpool({});
    deployNonWhitelistedWhirlpoolRes = await WhirlpoolUtil.deployWhirlpool({
      tokenA: deployWhirlpoolRes.tokenA,
      tokenB: deployWhirlpoolRes.tokenB,
      tokenOwnerKeypair: deployWhirlpoolRes.tokenOwnerKeypair,
    });
    fetcher = new AccountFetcher(WhirlpoolUtil.provider.connection);
  });

  beforeEach(async () => {
    deployVaultRes = await VaultUtil.deployVault({
      tokenA: deployWhirlpoolRes.tokenA,
      tokenB: deployWhirlpoolRes.tokenB,
      whitelistedSwaps: [deployWhirlpoolRes.initWhirlpoolRes.whirlpool],
      tokenOwnerKeypair: deployWhirlpoolRes.tokenOwnerKeypair,
    });

    dripTrigger = dripOrcaWhirlpoolWrapper(
      deployVaultRes.botKeypair,
      deployVaultRes.botTokenAAcount,
      deployVaultRes.vault,
      deployVaultRes.vaultProtoConfig,
      deployVaultRes.vaultTokenAAccount,
      deployVaultRes.vaultTokenBAccount,
      deployWhirlpoolRes.tokenA.publicKey,
      deployWhirlpoolRes.tokenB.publicKey,
      deployWhirlpoolRes.initWhirlpoolRes.tokenVaultAKeypair.publicKey,
      deployWhirlpoolRes.initWhirlpoolRes.tokenVaultBKeypair.publicKey,
      deployWhirlpoolRes.initWhirlpoolRes.whirlpool,
      deployWhirlpoolRes.initWhirlpoolRes.oracle
    );
  });

  it("should drip once", async () => {
    let [
      vaultTokenAAccountBefore,
      vaultTokenBAccountBefore,
      botTokenAAccountBefore,
      vaultBefore,
      period0Before,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.botTokenAAcount),
      AccountUtil.fetchVaultAccount(deployVaultRes.vault),
      AccountUtil.fetchVaultPeriodAccount(deployVaultRes.vaultPeriods[0]),
    ]);
    botTokenAAccountBefore.balance.toNumber().should.equal(0);
    vaultBefore.lastDripPeriod
      .toNumber()
      .should.equal(period0Before.periodId.toNumber());

    const whirlpoolClient = buildWhirlpoolClient(WhirlpoolUtil.whirlpoolCtx);
    const whirlpool = await whirlpoolClient.getPool(
      deployWhirlpoolRes.initWhirlpoolRes.whirlpool,
      false
    );
    const quote = await swapQuoteByInputToken(
      whirlpool,
      deployWhirlpoolRes.tokenA.publicKey,
      vaultBefore.dripAmount,
      Percentage.fromFraction(0, 100),
      ProgramUtil.orcaWhirlpoolProgram.programId,
      fetcher,
      false
    );
    await dripTrigger(
      deployVaultRes.vaultPeriods[0],
      deployVaultRes.vaultPeriods[1],
      quote.tickArray0,
      quote.tickArray1,
      quote.tickArray2
    );
    let [
      vaultTokenAAccountAfter,
      vaultTokenBAccountAfter,
      botTokenAAccountAfter,
      vaultAfter,
      period0After,
      period1Before,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.botTokenAAcount),
      AccountUtil.fetchVaultAccount(deployVaultRes.vault),
      AccountUtil.fetchVaultPeriodAccount(deployVaultRes.vaultPeriods[0]),
      AccountUtil.fetchVaultPeriodAccount(deployVaultRes.vaultPeriods[1]),
    ]);
    vaultTokenAAccountBefore.balance
      .gt(vaultTokenAAccountAfter.balance)
      .should.be.true();
    vaultTokenBAccountBefore.balance
      .lt(vaultTokenBAccountAfter.balance)
      .should.be.true();
    botTokenAAccountBefore.balance
      .lt(botTokenAAccountAfter.balance)
      .should.be.true();
    period0Before.twap.lt(period0After.twap).should.be.true();
    vaultAfter.lastDripPeriod
      .toNumber()
      .should.equal(period1Before.periodId.toNumber());
  });

  it("should drip with inverted swap (b to a)", async () => {});

  it("should drip dca_cyles number of times", async () => {});

  it("should fail to drip if a non-whitelisted whirlpool is provided", async () => {});

  // The tests below are generic for any drip_xxx instruction variant but we can't really generalize
  // them because each drip_xxx variant has a different interface
  // TODO(Mocha): Look into creating a drip_xxx class that abstracts the drip functionality for testing the below
  // as well as the deposit + close position tests

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
