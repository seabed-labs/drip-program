import { testTriggerDCA } from "./triggerDCA";
import { buildWhirlpoolClient } from "@orca-so/whirlpools-sdk";

describe("#dripOrcaWhirlpool", testDripOrcaWhirlpool);

export function testDripOrcaWhirlpool() {
  // Setup token mints
  // Setup whirlpool
  before(async () => {
  });

  // Setup vaultProtoConfig
  // Setup vault
  // Setup user keys
  beforeEach(async () => {});

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
