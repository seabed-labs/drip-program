import "should";
import { web3 } from "@project-serum/anchor";
import { AccountUtil } from "../utils/account.util";
import { ProgramUtil } from "../utils/program.util";

describe("Test Dependent Programs", () => {
  it("should have the token swap program", async () => {
    const tokenSwapProgram = await AccountUtil.fetchAccountInfo(
      new web3.PublicKey(ProgramUtil.tokenSwapProgram.programId)
    );
    tokenSwapProgram.should.not.be.undefined();
  });

  it("should have the orca whirlpool program", async () => {
    const orcaWhirlpoolProgram = await AccountUtil.fetchAccountInfo(
      new web3.PublicKey(ProgramUtil.orcaWhirlpoolProgram.programId)
    );
    orcaWhirlpoolProgram.should.not.be.undefined();
  });
});
