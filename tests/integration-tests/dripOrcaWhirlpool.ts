import {
  DeployWhirlpoolRes,
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
import { deployVaultProtoConfig } from "../utils/setup.util";
import { DeployVaultRes, VaultUtil } from "../utils/vault.util";

describe("#dripOrcaWhirlpool", testDripOrcaWhirlpool);

export function testDripOrcaWhirlpool() {
  let deployWhirlpoolRes: DeployWhirlpoolRes;
  let deployNonWhitelistedWhirlpoolRes: DeployWhirlpoolRes;
  let deployVaultRes: DeployVaultRes;

  before(async () => {
    deployWhirlpoolRes = await WhirlpoolUtil.deployWhirlpool({});
    deployNonWhitelistedWhirlpoolRes = await WhirlpoolUtil.deployWhirlpool({
      tokenA: deployWhirlpoolRes.tokenA,
      tokenB: deployWhirlpoolRes.tokenB,
    });
  });

  beforeEach(async () => {
    deployVaultRes = await VaultUtil.deployVault({
      tokenA: deployWhirlpoolRes.tokenA,
      tokenB: deployWhirlpoolRes.tokenB,
      whitelistedSwaps: [deployWhirlpoolRes.initWhirlpoolRes.whirlpool],
      tokenOwnerKeypair: deployWhirlpoolRes.tokenOwnerKeypair,
    });
  });

  it("should drip twice with expected TWAP and balance values", async () => {});

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
