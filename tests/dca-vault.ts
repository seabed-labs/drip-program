import { testInitVault } from "./integration-tests/initVault";
import { testInitVaultProtoConfig } from "./integration-tests/initVaultProtoConfig";
import { testInitVaultPeriod } from "./integration-tests/initVaultPeriod";
import { testDeposit } from "./integration-tests/deposit";
import { testClosePosition } from "./integration-tests/closePosition";
import { testTriggerDCA } from "./integration-tests/triggerDCA";
import sinon from "sinon";
import { testWithdrawB } from "./integration-tests/withdrawB";
import { setupKeeperBot } from "./deps-test/setupKeeperBot";

const DISABLE_LOGGING = !process.env.LOG;
const SETUP_BOT = process.env.SETUP_BOT;

if (DISABLE_LOGGING) {
  console.log("DISABLED LOGGING");
  sinon.stub(console, "log");
  sinon.stub(console, "error");
  sinon.stub(console, "warn");
  sinon.stub(console, "info");
}

if (SETUP_BOT) {
  describe("Setup Programs for Keeper Bot", setupKeeperBot);
} else {
  describe("DCA Vault Program Integration Tests", () => {
    describe("#initVaultProtoConfig", testInitVaultProtoConfig);
    describe("#initVault", testInitVault);
    describe("#initVaultPeriod", testInitVaultPeriod);
    describe("#deposit", testDeposit);
    describe.only("#withdrawB", testWithdrawB);
    describe("#closePosition", testClosePosition);
    describe("#triggerDCA", testTriggerDCA);
  });
}
