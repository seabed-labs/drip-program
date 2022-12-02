import "should";
import { WhirlpoolUtil } from "../../utils/whirlpool.util";
import { dripOrcaWhirlpoolWrapper } from "../../utils/setup.util";
import { DripUtil } from "../../utils/drip.util";
import {
  DripCommonSetup,
  testV1DripCommon,
} from "../../utils/dripV1Common.utils";

describe("#dripOrcaWhirlpool", testDripOrcaWhirlpool);

export function testDripOrcaWhirlpool() {
  const setup: DripCommonSetup = async () => {
    const deploySwap1Res = await WhirlpoolUtil.deployWhirlpool({});
    const deployVaultABRes = await DripUtil.deployVault({
      tokenA: deploySwap1Res.tokenA,
      tokenB: deploySwap1Res.tokenB,
      tokenOwnerKeypair: deploySwap1Res.tokenOwnerKeypair,
      whitelistedSwaps: [deploySwap1Res.initWhirlpoolRes.whirlpool],
      shouldCreateUserPosition: true,
    });
    const deployVaultBARes = await DripUtil.deployVault({
      tokenA: deploySwap1Res.tokenB,
      tokenB: deploySwap1Res.tokenA,
      whitelistedSwaps: [deploySwap1Res.initWhirlpoolRes.whirlpool],
      tokenOwnerKeypair: deploySwap1Res.tokenOwnerKeypair,
      shouldCreateUserPosition: true,
    });
    const dripWithWhitelistedSwap = await dripOrcaWhirlpoolWrapper(
      deploySwap1Res.initWhirlpoolRes.tokenVaultAKeypair.publicKey,
      deploySwap1Res.initWhirlpoolRes.tokenVaultBKeypair.publicKey,
      deploySwap1Res.initWhirlpoolRes.whirlpool,
      deploySwap1Res.initWhirlpoolRes.oracle
    );
    const deploySwap2Res = await WhirlpoolUtil.deployWhirlpool({
      tokenA: deploySwap1Res.tokenA,
      tokenB: deploySwap1Res.tokenB,
      tokenOwnerKeypair: deploySwap1Res.tokenOwnerKeypair,
    });
    const dripWithNonWhitelistedSwap = await dripOrcaWhirlpoolWrapper(
      deploySwap2Res.initWhirlpoolRes.tokenVaultAKeypair.publicKey,
      deploySwap2Res.initWhirlpoolRes.tokenVaultBKeypair.publicKey,
      deploySwap2Res.initWhirlpoolRes.whirlpool,
      deploySwap2Res.initWhirlpoolRes.oracle
    );
    return {
      dripWithWhitelistedSwap,
      dripWithNonWhitelistedSwap,
      deployVaultABRes,
      deployVaultBARes,
    };
  };

  testV1DripCommon(setup);
}
