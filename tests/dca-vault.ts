import { testInitVault } from "./integration-tests/initVault";
import { testInitVaultProtoConfig } from "./integration-tests/initVaultProtoConfig";
import { testInitVaultPeriod } from "./integration-tests/initVaultPeriod";
import { testDeposit } from "./integration-tests/deposit";
// TODO: Put behind an env var
import sinon from "sinon";

const DISABLE_LOGGING = true;

if (DISABLE_LOGGING) {
  sinon.stub(console, "log");
  sinon.stub(console, "error");
  sinon.stub(console, "warn");
  sinon.stub(console, "info");
}

describe("DCA Vault Program Integration Tests", () => {
  describe("#initVaultProtoConfig", testInitVaultProtoConfig);
  describe("#initVault", testInitVault);
  describe("#initVaultPeriod", testInitVaultPeriod);
  describe("#deposit", testDeposit);
});
