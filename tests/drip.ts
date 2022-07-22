import { testInitVault } from "./integration-tests/initVault";
import { testInitVaultProtoConfig } from "./integration-tests/initVaultProtoConfig";
import { testInitVaultPeriod } from "./integration-tests/initVaultPeriod";
import { testDeposit } from "./integration-tests/deposit";
import { testClosePosition } from "./integration-tests/closePosition";
import { testTriggerDCA } from "./integration-tests/triggerDCA";
import { testWithdrawB } from "./integration-tests/withdrawB";
import { setupKeeperBotUtil } from "./utils/setupKeeperBot.util";
import { AccountUtil } from "./utils/Account.util";
import { web3 } from "@project-serum/anchor";
import { ProgramUtil } from "./utils/Program.util";

import sinon from "sinon";

const DISABLE_LOGGING = !process.env.LOG;

if (DISABLE_LOGGING) {
  console.log("DISABLED LOGGING");
  sinon.stub(console, "log");
  sinon.stub(console, "error");
  sinon.stub(console, "warn");
  sinon.stub(console, "info");
}

const SETUP_BOT = process.env.SETUP_BOT;
// if (SETUP_BOT) {
//   describe("Setup Programs for Keeper Bot", setupKeeperBotUtil);
// } else {
//   describe("Drip Program Integration Tests", () => {
//     // describe("#initVaultProtoConfig", testInitVaultProtoConfig);
//     // describe("#initVault", testInitVault);
//     // describe("#initVaultPeriod", testInitVaultPeriod);
//     // describe("#deposit", testDeposit);
//     // describe("#withdrawB", testWithdrawB);
//     // describe("#closePosition", testClosePosition);
//     // describe("#triggerDCA", testTriggerDCA);
//     // it("should have the token swap program", async () => {
//     //   const tokenSwapProgram = await AccountUtil.fetchAccountInfo(
//     //     new web3.PublicKey(ProgramUtil.tokenSwapProgram.programId)
//     //   );
//     //   tokenSwapProgram.should.not.be.undefined();
//     // });
//   });
// }
