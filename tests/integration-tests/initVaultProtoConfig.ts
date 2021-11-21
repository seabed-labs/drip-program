import { AccountUtils } from "../utils/AccountUtils";
import { ExpectUtils } from "../utils/ExpectUtils";
import { Granularity } from "../utils/Granularity";
import { KeypairUtils } from "../utils/KeypairUtils";
import { VaultUtils } from "../utils/VaultUtils";

export function testInitVaultProtoConfig() {
  it('initializes the vault proto config account correctly', async () => {
    const vaultProtoConfigKeypair = KeypairUtils.generatePair();
    await VaultUtils.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.DAILY,
    });
    const vaultProtoConfigAccount = await AccountUtils.fetchVaultProtoConfigAccount(vaultProtoConfigKeypair.publicKey);

    ExpectUtils.expectBNToEqual(vaultProtoConfigAccount.granularity, 86400000);
  });
}