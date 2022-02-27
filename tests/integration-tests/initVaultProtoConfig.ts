import { AccountUtils } from "../utils/AccountUtils";
import { Granularity } from "../utils/Granularity";
import { KeypairUtils } from "../utils/KeypairUtils";
import { VaultUtils } from "../utils/VaultUtils";

export function testInitVaultProtoConfig() {
  it("initializes the vault proto config account correctly", async () => {
    const vaultProtoConfigKeypair = KeypairUtils.generatePair();
    await VaultUtils.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.DAILY,
    });
    const vaultProtoConfigAccount =
      await AccountUtils.fetchVaultProtoConfigAccount(
        vaultProtoConfigKeypair.publicKey
      );
    // Make sure the granularity is actually 1 day (24 hours) in second
    vaultProtoConfigAccount.granularity.toString().should.equal("86400");
  });

  it("errors when granularity is 0", async () => {
    const vaultProtoConfigKeypair = KeypairUtils.generatePair();
    await VaultUtils.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: 0,
    })
      .should.rejected()
      .catch((err) =>
        err
          .toString()
          .should.equal("Granularity must be an integer larger than 0")
      );
  });

  it("errors when granularity is negative", async () => {
    const vaultProtoConfigKeypair = KeypairUtils.generatePair();
    await VaultUtils.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: -10,
    })
      .should.rejected()
      .catch((err) =>
        err
          .toString()
          .should.equal("Granularity must be an integer larger than 0")
      );
  });

  it("errors when granularity is not a number", async () => {
    const vaultProtoConfigKeypair = KeypairUtils.generatePair();
    await VaultUtils.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: "1o" as any as number,
    })
      .should.rejected()
      .catch((err) =>
        err
          .toString()
          .should.equal("Granularity must be an integer larger than 0")
      );
  });
}
