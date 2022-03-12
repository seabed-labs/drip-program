import { testInitVault } from "./integration-tests/initVault";
import { testInitVaultProtoConfig } from "./integration-tests/initVaultProtoConfig";
import { testInitVaultPeriod } from "./integration-tests/initVaultPeriod";
import { testDeposit } from "./integration-tests/deposit";
import { testClosePosition } from "./integration-tests/closePosition";
import { testTriggerDCA } from "./integration-tests/triggerDCA";
import sinon from "sinon";

const DISABLE_LOGGING = !process.env.LOG;

if (DISABLE_LOGGING) {
  console.log("DISABLED LOGGING");
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
  describe("#closePosition", testClosePosition);
  describe.only("#triggerDCA", testTriggerDCA);
});
