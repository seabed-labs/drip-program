import "should";
import { TokenUtil } from "../../utils/token.util";
import {
  sleep,
  dripSPLTokenSwapWrapper,
  GenericDripWrapper,
} from "../../utils/setup.util";
import { AccountUtil } from "../../utils/account.util";
import { DeployVaultRes, DripUtil } from "../../utils/drip.util";
import { TokenSwapUtil } from "../../utils/tokenSwapUtil";
import {
  DripCommonSetup,
  testV1DripCommon,
} from "../../utils/dripV1Common.utils";

describe("#dripSPLTokenSwap", testDripSPLTokenSwap);

export function testDripSPLTokenSwap() {
  let dripWithWhitelistedSwap: GenericDripWrapper;
  let deployVaultABRes: DeployVaultRes;

  const setup: DripCommonSetup = async () => {
    const deploySwap1Res = await TokenSwapUtil.deployTokenSwap({});
    const deployVaultABRes = await DripUtil.deployVault({
      tokenA: deploySwap1Res.tokenA,
      tokenB: deploySwap1Res.tokenB,
      tokenOwnerKeypair: deploySwap1Res.tokenOwnerKeypair,
      whitelistedSwaps: [deploySwap1Res.tokenSwap.tokenSwap],
      shouldCreateUserPosition: true,
    });
    const deployVaultBARes = await DripUtil.deployVault({
      tokenA: deploySwap1Res.tokenB,
      tokenB: deploySwap1Res.tokenA,
      tokenOwnerKeypair: deploySwap1Res.tokenOwnerKeypair,
      whitelistedSwaps: [deploySwap1Res.tokenSwap.tokenSwap],
      shouldCreateUserPosition: true,
    });
    const dripWithWhitelistedSwap = dripSPLTokenSwapWrapper(
      deploySwap1Res.tokenSwap.poolToken,
      deploySwap1Res.tokenSwap.tokenAccountA,
      deploySwap1Res.tokenSwap.tokenAccountB,
      deploySwap1Res.tokenSwap.feeAccount,
      deploySwap1Res.tokenSwap.authority,
      deploySwap1Res.tokenSwap.tokenSwap
    );
    const deploySwap2Res = await TokenSwapUtil.deployTokenSwap({
      tokenA: deploySwap1Res.tokenA,
      tokenB: deploySwap1Res.tokenB,
      tokenOwnerKeypair: deploySwap1Res.tokenOwnerKeypair,
    });
    const dripWithNonWhitelistedSwap = dripSPLTokenSwapWrapper(
      deploySwap2Res.tokenSwap.poolToken,
      deploySwap2Res.tokenSwap.tokenAccountA,
      deploySwap2Res.tokenSwap.tokenAccountB,
      deploySwap2Res.tokenSwap.feeAccount,
      deploySwap2Res.tokenSwap.authority,
      deploySwap2Res.tokenSwap.tokenSwap
    );
    return {
      dripWithWhitelistedSwap,
      dripWithNonWhitelistedSwap,
      deployVaultABRes,
      deployVaultBARes,
    };
  };

  beforeEach(async () => {
    const setupRes = await setup();
    deployVaultABRes = setupRes.deployVaultABRes;
    dripWithWhitelistedSwap = setupRes.dripWithWhitelistedSwap;
  });

  testV1DripCommon(setup);

  it("should trigger drip twice with expected TWAP and Balance values", async () => {
    await dripWithWhitelistedSwap(
      deployVaultABRes,
      deployVaultABRes.vaultPeriods[0],
      deployVaultABRes.vaultPeriods[1]
    );

    let [
      vaultTokenAAccountAfter,
      vaultTokenBAccountAfter,
      botTokenAAccountAfter,
      vaultAfter,
      lastVaultPeriod,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultABRes.vaultTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultABRes.vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultABRes.botTokenAAcount),
      AccountUtil.fetchVaultAccount(deployVaultABRes.vault),
      AccountUtil.fetchVaultPeriodAccount(deployVaultABRes.vaultPeriods[1]),
    ]);

    vaultAfter.lastDripPeriod.toString().should.equal("1");
    vaultTokenAAccountAfter.balance.toString().should.equal("750000000");
    vaultTokenBAccountAfter.balance.toString().should.equal("248994550");
    botTokenAAccountAfter.balance.toString().should.equal("250000");
    lastVaultPeriod.twap.toString().should.equal("18390945904298204746");
    lastVaultPeriod.dripTimestamp.toString().should.not.equal("0");

    await sleep(1500);
    await dripWithWhitelistedSwap(
      deployVaultABRes,
      deployVaultABRes.vaultPeriods[1],
      deployVaultABRes.vaultPeriods[2]
    );

    [
      vaultTokenAAccountAfter,
      vaultTokenBAccountAfter,
      botTokenAAccountAfter,
      vaultAfter,
      lastVaultPeriod,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultABRes.vaultTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultABRes.vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultABRes.botTokenAAcount),
      AccountUtil.fetchVaultAccount(deployVaultABRes.vault),
      AccountUtil.fetchVaultPeriodAccount(deployVaultABRes.vaultPeriods[2]),
    ]);

    vaultAfter.lastDripPeriod.toString().should.equal("2");
    vaultTokenAAccountAfter.balance.toString().should.equal("500000000");
    vaultTokenBAccountAfter.balance.toString().should.equal("497976682");
    botTokenAAccountAfter.balance.toString().should.equal("500000");
    lastVaultPeriod.twap.toString().should.equal("18390487302360452343");
  });
}
