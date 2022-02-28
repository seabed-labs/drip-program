import { AccountUtils } from "../utils/AccountUtils";
import { web3 } from "@project-serum/anchor";

describe("Test Dependent Programs Exist", () => {
  it("should have the token swap program", async () => {
    const tokenSwapProgram = await AccountUtils.fetchAccountInfo(
      new web3.PublicKey("SwaPpA9LAaLfeLi3a68M4DjnLqgtticKg6CnyNwgAC8")
    );
    tokenSwapProgram.should.not.be.undefined();
  });
});
