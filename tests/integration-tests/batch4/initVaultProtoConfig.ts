import "should";
import { AccountUtil } from "../../utils/account.util";
import { VaultUtil } from "../../utils/vault.util";
import { generatePair, Granularity } from "../../utils/common.util";
import { findError } from "../../utils/error.util";
import { initLog } from "../../utils/log.util";

describe("#initVaultProtoConfig", testInitVaultProtoConfig);

export function testInitVaultProtoConfig() {
  initLog();

  it("initializes the vault proto config account correctly", async () => {
    const vaultProtoConfigKeypair = generatePair();
    const admin = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.DAILY,
      tokenADripTriggerSpread: 5,
      tokenBWithdrawalSpread: 10,
      admin: admin.publicKey,
    });
    const vaultProtoConfigAccount =
      await AccountUtil.fetchVaultProtoConfigAccount(
        vaultProtoConfigKeypair.publicKey
      );
    // Make sure the granularity is actually 1 day (24 hours) in second
    vaultProtoConfigAccount.granularity.toString().should.equal("86400");
    vaultProtoConfigAccount.tokenADripTriggerSpread
      .toString()
      .should.equal("5");
    vaultProtoConfigAccount.tokenBWithdrawalSpread
      .toString()
      .should.equal("10");
    vaultProtoConfigAccount.admin
      .toString()
      .should.equal(admin.publicKey.toString());
  });

  it("uses absolute value when granularity is negative", async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: -10,
      tokenADripTriggerSpread: 5,
      tokenBWithdrawalSpread: 5,
      admin: generatePair().publicKey,
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
      tokenADripTriggerSpread: 5,
      tokenBWithdrawalSpread: 5,
      admin: generatePair().publicKey,
    }).should.be.rejectedWith(/0x1775/);
  });

  it("errors when granularity is not a number", async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: "1o" as any,
      tokenADripTriggerSpread: 5,
      tokenBWithdrawalSpread: 5,
      admin: generatePair().publicKey,
    }).should.be.rejectedWith(/Invalid character/);
  });

  it("errors when token_a_drip_trigger_spread is not within u16 bound", async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.MONTHLY,
      tokenADripTriggerSpread: 70000,
      tokenBWithdrawalSpread: 5,
      admin: generatePair().publicKey,
    }).should.rejectedWith(
      /The value of "value" is out of range. It must be >= 0 and <= 65535. Received 70000/
    );
  });

  it("errors when token_b_withdrawal_spread is not within u16 bound", async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.MONTHLY,
      tokenADripTriggerSpread: 5,
      tokenBWithdrawalSpread: 70000,
      admin: generatePair().publicKey,
    }).should.rejectedWith(
      /The value of "value" is out of range. It must be >= 0 and <= 65535. Received 70000/
    );
  });

  it("errors when token_a_drip_trigger_spread is ge than 5000", async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.MONTHLY,
      tokenADripTriggerSpread: 5000,
      tokenBWithdrawalSpread: 5,
      admin: generatePair().publicKey,
    }).should.be.rejectedWith(/0x1777/);
  });

  it("errors when token_b_withdrawal_spread is ge than 5000", async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.MONTHLY,
      tokenADripTriggerSpread: 5,
      tokenBWithdrawalSpread: 5000,
      admin: generatePair().publicKey,
    }).should.be.rejectedWith(/0x1777/);
  });
}
