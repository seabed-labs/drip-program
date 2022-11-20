import "should";
import { web3 } from "@project-serum/anchor";
import { AccountUtil } from "../../utils/account.util";
import { ProgramUtil } from "../../utils/program.util";
import { parsePriceData, parseProductData } from "../../utils/pyth";

describe("Test External Accounts", () => {
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

  it("should have the metaplex token metadata program", async () => {
    const metadataProgram = await AccountUtil.fetchAccountInfo(
      new web3.PublicKey(ProgramUtil.metadataProgram.programId)
    );
    metadataProgram.should.not.be.undefined();
  });

  it("should have the pyth program", async () => {
    const pythProgram = await AccountUtil.fetchAccountInfo(
      new web3.PublicKey(ProgramUtil.pythProgram.programId)
    );
    pythProgram.should.not.be.undefined();
  });

  it("should have the pyth ETH price account", async () => {
    let info = await AccountUtil.fetchAccountInfo(
      ProgramUtil.pythETHPriceAccount.address
    );
    const priceData = parsePriceData(info.data as any);
    priceData.productAccountKey
      .toString()
      .should.equal("EMkxjGC1CQ7JLiutDbfYb7UKb3zm9SJcUmr1YicBsdpZ");

    info = await AccountUtil.fetchAccountInfo(
      new web3.PublicKey("EMkxjGC1CQ7JLiutDbfYb7UKb3zm9SJcUmr1YicBsdpZ")
    );
    const productData = parseProductData(info.data as any);
    productData.product["quote_currency"].should.equal("USD");
    productData.product["base"].should.equal("ETH");
  });

  it("should have the pyth USDC price account", async () => {
    let info = await AccountUtil.fetchAccountInfo(
      ProgramUtil.pythUSDCPriceAccount.address
    );
    const priceData = parsePriceData(info.data as any);
    priceData.productAccountKey
      .toString()
      .should.equal("8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb");

    info = await AccountUtil.fetchAccountInfo(
      new web3.PublicKey("8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb")
    );
    const productData = parseProductData(info.data as any);
    productData.product["quote_currency"].should.equal("USD");
    productData.product["base"].should.equal("USDC");
  });
});
