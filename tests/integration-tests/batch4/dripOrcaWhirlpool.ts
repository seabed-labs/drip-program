import "should";
import { DeployWhirlpoolRes, WhirlpoolUtil } from "../../utils/whirlpool.util";
import { TokenUtil } from "../../utils/token.util";
import {
  DripOrcaWhirlpoolWrapper,
  dripOrcaWhirlpoolWrapper,
} from "../../utils/setup.util";
import { DeployVaultRes, DripUtil } from "../../utils/drip.util";
import { AccountUtil } from "../../utils/account.util";
import {
  AccountFetcher,
  buildWhirlpoolClient,
  swapQuoteByInputToken,
} from "@orca-so/whirlpools-sdk";
import { ProgramUtil } from "../../utils/program.util";
import { Percentage } from "@orca-so/common-sdk";
import { generatePair } from "../../utils/common.util";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@project-serum/anchor";

describe("#dripOrcaWhirlpool", testDripOrcaWhirlpool);

export function testDripOrcaWhirlpool() {
  let deployWhirlpoolRes: DeployWhirlpoolRes;
  let deployVaultRes: DeployVaultRes;

  let dripTrigger: DripOrcaWhirlpoolWrapper;
  let fetcher;
  before(async () => {
    deployWhirlpoolRes = await WhirlpoolUtil.deployWhirlpool({});
    fetcher = new AccountFetcher(WhirlpoolUtil.provider.connection);
  });

  beforeEach(async () => {
    deployVaultRes = await DripUtil.deployVaultAndCreatePosition({
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
      period1Before,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.botTokenAAcount),
      AccountUtil.fetchVaultAccount(deployVaultRes.vault),
      AccountUtil.fetchVaultPeriodAccount(deployVaultRes.vaultPeriods[0]),
      AccountUtil.fetchVaultPeriodAccount(deployVaultRes.vaultPeriods[1]),
    ]);
    botTokenAAccountBefore.balance.toString().should.equal("0");
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
      vaultBefore.tokenAMint,
      vaultBefore.dripAmount,
      Percentage.fromFraction(10, 100),
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
      period1After,
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
    period0Before.twap.lt(period0After.twap).should.be.false();
    period1Before.twap.lt(period1After.twap).should.be.true();
    vaultAfter.lastDripPeriod
      .toNumber()
      .should.equal(period1After.periodId.toNumber());
  });

  it("should drip with inverted swap (b to a)", async () => {
    const [tokenA, tokenB] = [
      deployWhirlpoolRes.tokenB,
      deployWhirlpoolRes.tokenA,
    ];

    const deployVaultRes = await DripUtil.deployVaultAndCreatePosition({
      tokenA,
      tokenB,
      whitelistedSwaps: [deployWhirlpoolRes.initWhirlpoolRes.whirlpool],
      tokenOwnerKeypair: deployWhirlpoolRes.tokenOwnerKeypair,
    });

    const dripTrigger = dripOrcaWhirlpoolWrapper(
      deployVaultRes.botKeypair,
      deployVaultRes.botTokenAAcount,
      deployVaultRes.vault,
      deployVaultRes.vaultProtoConfig,
      deployVaultRes.vaultTokenAAccount,
      deployVaultRes.vaultTokenBAccount,
      deployWhirlpoolRes.initWhirlpoolRes.tokenVaultAKeypair.publicKey,
      deployWhirlpoolRes.initWhirlpoolRes.tokenVaultBKeypair.publicKey,
      deployWhirlpoolRes.initWhirlpoolRes.whirlpool,
      deployWhirlpoolRes.initWhirlpoolRes.oracle
    );

    let [
      vaultTokenAAccountBefore,
      vaultTokenBAccountBefore,
      botTokenAAccountBefore,
      vaultBefore,
      period0Before,
      period1Before,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.botTokenAAcount),
      AccountUtil.fetchVaultAccount(deployVaultRes.vault),
      AccountUtil.fetchVaultPeriodAccount(deployVaultRes.vaultPeriods[0]),
      AccountUtil.fetchVaultPeriodAccount(deployVaultRes.vaultPeriods[1]),
    ]);

    botTokenAAccountBefore.balance.toString().should.equal("0");
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
      vaultBefore.tokenAMint,
      vaultBefore.dripAmount,
      Percentage.fromFraction(10, 100),
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
      period1After,
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
    period0Before.twap.lt(period0After.twap).should.be.false();
    period1Before.twap.lt(period1After.twap).should.be.true();
    vaultAfter.lastDripPeriod
      .toNumber()
      .should.equal(period1After.periodId.toNumber());
  });

  it("should throw an error if the vault has an oracle config defined", async () => {
    const oracleConfig = generatePair();
    await DripUtil.initOracleConfig(
      {
        oracleConfig: oracleConfig,
        tokenAMint: deployVaultRes.tokenAMint.publicKey,
        tokenAPrice: new PublicKey(ProgramUtil.pythETHPriceAccount.address),
        tokenBMint: deployVaultRes.tokenBMint.publicKey,
        tokenBPrice: new PublicKey(ProgramUtil.pythUSDCPriceAccount.address),
        creator: deployVaultRes.admin,
      },
      {
        enabled: true,
        source: 0,
        updateAuthority: deployVaultRes.admin.publicKey,
      }
    );
    await DripUtil.setVaultOracleConfig({
      admin: deployVaultRes.admin,
      vault: deployVaultRes.vault,
      vaultProtoConfig: deployVaultRes.vaultProtoConfig,
      newOracleConfig: oracleConfig.publicKey,
    });
    const whirlpoolClient = buildWhirlpoolClient(WhirlpoolUtil.whirlpoolCtx);
    const whirlpool = await whirlpoolClient.getPool(
      deployWhirlpoolRes.initWhirlpoolRes.whirlpool,
      false
    );
    const quote = await swapQuoteByInputToken(
      whirlpool,
      deployVaultRes.tokenAMint.publicKey,
      new BN(1),
      Percentage.fromFraction(10, 100),
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
    ).should.be.rejectedWith(/0x178b/);
  });
}
