import { testInitVault } from "./integration-tests/initVault";
import { testInitVaultProtoConfig } from "./integration-tests/initVaultProtoConfig";

describe("DCA Vault Program Integration Tests", () => {
  describe("#initVaultProtoConfig", testInitVaultProtoConfig);
  describe("#initVault", testInitVault);
});
