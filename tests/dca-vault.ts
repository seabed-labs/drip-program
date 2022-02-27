import { testInitVault } from "./integration-tests/initVault";
import { testInitVaultProtoConfig } from "./integration-tests/initVaultProtoConfig";
import { testInitVaultPeriod } from "./integration-tests/initVaultPeriod";

describe("DCA Vault Program Integration Tests", () => {
  describe("#initVaultProtoConfig", testInitVaultProtoConfig);
  describe("#initVault", testInitVault);
  describe("#initVaultPeriod", testInitVaultPeriod);
});
