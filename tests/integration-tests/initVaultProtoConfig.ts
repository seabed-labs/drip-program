import { AccountUtil } from "../utils/Account.util";
import { VaultUtil } from "../utils/Vault.util";
import { generatePair, Granularity } from "../utils/common.util";

export function testInitVaultProtoConfig() {
  it("initializes the vault proto config account correctly", async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.DAILY,
    });
    const vaultProtoConfigAccount =
      await AccountUtil.fetchVaultProtoConfigAccount(
        vaultProtoConfigKeypair.publicKey
      );
    // Make sure the granularity is actually 1 day (24 hours) in second
    vaultProtoConfigAccount.granularity.toString().should.equal("86400");
  });

  it("uses absolute value when granularity is negative", async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: -10,
    });
    const vaultProtoConfigAccount =
      await AccountUtil.fetchVaultProtoConfigAccount(
        vaultProtoConfigKeypair.publicKey
      );
    vaultProtoConfigAccount.granularity.toString().should.equal("10");
  });

  it("errors when granularity is 0", async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: 0,
    }).should.rejectedWith(
      new RegExp(".*Granularity must be an integer larger than 0")
    );
  });

  it("errors when granularity is not a number", async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: "1o" as any as number,
    }).should.rejectedWith(new RegExp(".*Invalid character"));
  });
}
