import { AccountUtil } from "../utils/Account.util";
import { VaultUtil } from "../utils/Vault.util";
import { generatePair, Granularity } from "../utils/common.util";

export function testInitVaultProtoConfig() {
  it("initializes the vault proto config account correctly", async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.DAILY,
      triggerDCASpread: 5,
      baseWithdrawalSpread: 10,
    });
    const vaultProtoConfigAccount =
      await AccountUtil.fetchVaultProtoConfigAccount(
        vaultProtoConfigKeypair.publicKey
      );
    // Make sure the granularity is actually 1 day (24 hours) in second
    vaultProtoConfigAccount.granularity.toString().should.equal("86400");
    vaultProtoConfigAccount.triggerDcaSpread.toString().should.equal("5");
    vaultProtoConfigAccount.baseWithdrawalSpread.toString().should.equal("10");
  });

  it("uses absolute value when granularity is negative", async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: -10,
      triggerDCASpread: 5,
      baseWithdrawalSpread: 5,
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
      triggerDCASpread: 5,
      baseWithdrawalSpread: 5,
    }).should.rejectedWith(
      new RegExp(".*Granularity must be an integer larger than 0")
    );
  });

  it("errors when granularity is not a number", async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: "1o" as any as number,
      triggerDCASpread: 5,
      baseWithdrawalSpread: 5,
    }).should.rejectedWith(new RegExp(".*Invalid character"));
  });

  it("errors when triggerDCASpread is not within u16 bound", async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.MONTHLY,
      triggerDCASpread: 70000,
      baseWithdrawalSpread: 5,
    }).should.rejectedWith(
      new RegExp(
        '.*The value of "value" is out of range. It must be >= 0 and <= 65535. Received 70000'
      )
    );
  });
  it("errors when baseWithdrawalSpread is not within u16 bound", async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.MONTHLY,
      triggerDCASpread: 5,
      baseWithdrawalSpread: 70000,
    }).should.rejectedWith(
      new RegExp(
        '.*The value of "value" is out of range. It must be >= 0 and <= 65535. Received 70000'
      )
    );
  });
}
