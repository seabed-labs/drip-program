import "should";
import { AccountUtil } from "../../utils/account.util";
import { DripUtil } from "../../utils/drip.util";
import {
  generatePair,
  generatePairs,
  Granularity,
} from "../../utils/common.util";
import { Keypair, PublicKey, Signer } from "@solana/web3.js";
import { TokenUtil } from "../../utils/token.util";
import { SolUtil } from "../../utils/sol.util";
import { ProgramUtil } from "../../utils/program.util";

describe("#initOracleConfig", testInitOracleConfig);

export function testInitOracleConfig() {
  let tokenAMint;
  let tokenBMint;
  let tokenOwnerKeypair;
  let payerKeypair;

  before(async () => {
    [tokenOwnerKeypair, payerKeypair] = generatePairs(2);
    await Promise.all([
      SolUtil.fundAccount(payerKeypair.publicKey, SolUtil.solToLamports(0.1)),
      SolUtil.fundAccount(
        tokenOwnerKeypair.publicKey,
        SolUtil.solToLamports(0.1)
      ),
    ]);
    tokenAMint = await TokenUtil.createMint(
      tokenOwnerKeypair.publicKey,
      null,
      6,
      payerKeypair
    );
    tokenBMint = await TokenUtil.createMint(
      tokenOwnerKeypair.publicKey,
      null,
      6,
      payerKeypair
    );
  });

  it("initializes the oracle config account correctly", async () => {
    const oracleConfigKeypair = generatePair();
    const updateAuthority = generatePair();
    const accounts = {
      oracleConfig: oracleConfigKeypair,
      tokenAMint: tokenAMint.publicKey,
      tokenAPrice: ProgramUtil.pythETHPriceAccount.address,
      tokenBMint: tokenBMint.publicKey,
      tokenBPrice: ProgramUtil.pythUSDCPriceAccount.address,
      creator: payerKeypair,
    };
    const params = {
      enabled: true,
      source: 0,
      updateAuthority: updateAuthority.publicKey,
    };
    await DripUtil.initOracleConfig(accounts, params);
    const oracleConfigAccount = await AccountUtil.fetchOracleConfigAccount(
      oracleConfigKeypair.publicKey
    );
    oracleConfigAccount.enabled.should.equal(params.enabled);
    oracleConfigAccount.source.should.equal(params.source);
    oracleConfigAccount.updateAuthority
      .toString()
      .should.equal(updateAuthority.publicKey.toString());
    oracleConfigAccount.tokenAMint
      .toString()
      .should.equal(accounts.tokenAMint.toString());
    oracleConfigAccount.tokenAPrice
      .toString()
      .should.equal(accounts.tokenAPrice.toString());
    oracleConfigAccount.tokenBMint
      .toString()
      .should.equal(accounts.tokenBMint.toString());
    oracleConfigAccount.tokenBPrice
      .toString()
      .should.equal(accounts.tokenBPrice.toString());
  });

  it("should throw an error when an invalid source is passed in", async () => {
    const oracleConfigKeypair = generatePair();
    const updateAuthority = generatePair();
    const accounts = {
      oracleConfig: oracleConfigKeypair,
      tokenAMint: tokenAMint.publicKey,
      tokenAPrice: ProgramUtil.pythETHPriceAccount.address,
      tokenBMint: tokenBMint.publicKey,
      tokenBPrice: ProgramUtil.pythUSDCPriceAccount.address,
      creator: payerKeypair,
    };
    const params = {
      enabled: true,
      source: 1, // only 0 for pyth is supported for now
      updateAuthority: updateAuthority.publicKey,
    };
    // InvalidOracleSource
    await DripUtil.initOracleConfig(accounts, params).should.be.rejectedWith(
      /0x178a/
    );
  });

  it("should throw an error when token_a_price cannot be decoded correctly", async () => {
    const oracleConfigKeypair = generatePair();
    const updateAuthority = generatePair();
    const accounts = {
      oracleConfig: oracleConfigKeypair,
      tokenAMint: tokenAMint.publicKey,
      // passing product account instead of price account
      tokenAPrice: new PublicKey(
        "EMkxjGC1CQ7JLiutDbfYb7UKb3zm9SJcUmr1YicBsdpZ"
      ),
      tokenBMint: tokenBMint.publicKey,
      tokenBPrice: ProgramUtil.pythUSDCPriceAccount.address,
      creator: payerKeypair,
    };
    const params = {
      enabled: true,
      source: 0,
      updateAuthority: updateAuthority.publicKey,
    };
    // todo: we can throw a custom error here
    await DripUtil.initOracleConfig(accounts, params).should.be.rejectedWith(
      /Error processing Instruction 0: Program failed to complete/
    );
  });

  it("should throw an error when token_b_price cannot be decoded correctly", async () => {
    const oracleConfigKeypair = generatePair();
    const updateAuthority = generatePair();
    const accounts = {
      oracleConfig: oracleConfigKeypair,
      tokenAMint: tokenAMint.publicKey,
      tokenAPrice: ProgramUtil.pythETHPriceAccount.address,
      tokenBMint: tokenBMint.publicKey,
      // passing product account instead of price account
      tokenBPrice: new PublicKey(
        "8GWTTbNiXdmyZREXbjsZBmCRuzdPrW55dnZGDkTRjWvb"
      ),
      creator: payerKeypair,
    };
    const params = {
      enabled: true,
      source: 0,
      updateAuthority: updateAuthority.publicKey,
    };
    // todo: we can throw a custom error here
    await DripUtil.initOracleConfig(accounts, params).should.be.rejectedWith(
      /Error processing Instruction 0: Program failed to complete/
    );
  });
}
