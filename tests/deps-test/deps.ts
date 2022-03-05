import { AccountUtils } from "../utils/AccountUtils";
import { web3 } from "@project-serum/anchor";
import { ProgramUtils } from "../utils/ProgramUtils";

describe("Test Dependent Programs Exist", () => {
  it("should have the token swap program", async () => {
    const tokenSwapProgram = await AccountUtils.fetchAccountInfo(
      new web3.PublicKey(ProgramUtils.tokenSwapProgram.programId)
    );
    tokenSwapProgram.should.not.be.undefined();
  });
});
