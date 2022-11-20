import "should";
import { AccountUtil } from "../../utils/account.util";
import { DripUtil } from "../../utils/drip.util";
import { generatePair } from "../../utils/common.util";
import { Keypair, PublicKey } from "@solana/web3.js";
import { TokenUtil } from "../../utils/token.util";
import { SolUtil } from "../../utils/sol.util";
import { Token } from "@solana/spl-token";
import { ProgramUtil } from "../../utils/program.util";

describe("#updateOracleConfig", testUpdateOracleConfig);

function testUpdateOracleConfig() {
  let tokenAMint: Token;
  let tokenBMint: Token;

  let updateAuthority: Keypair;
  let oracleConfig: PublicKey;

  beforeEach(async () => {
    updateAuthority = generatePair();
    await Promise.all([
      SolUtil.fundAccount(
        updateAuthority.publicKey,
        SolUtil.solToLamports(0.2)
      ),
    ]);
    tokenAMint = await TokenUtil.createMint(
      updateAuthority.publicKey,
      null,
      6,
      updateAuthority
    );
    tokenBMint = await TokenUtil.createMint(
      updateAuthority.publicKey,
      null,
      6,
      updateAuthority
    );

    const oracleConfigKeypair = generatePair();
    oracleConfig = oracleConfigKeypair.publicKey;
    const accounts = {
      oracleConfig: oracleConfigKeypair,
      tokenAMint: tokenAMint.publicKey,
      tokenAPrice: ProgramUtil.pythETHPriceAccount.address,
      tokenBMint: tokenBMint.publicKey,
      tokenBPrice: ProgramUtil.pythUSDCPriceAccount.address,
      creator: updateAuthority,
    };
    const params = {
      enabled: true,
      source: 0,
      updateAuthority: updateAuthority.publicKey,
    };
    await DripUtil.initOracleConfig(accounts, params);
  });

  it("should be able to update an existing oracle config", async () => {
    const oracleConfigAccountBefore =
      await AccountUtil.fetchOracleConfigAccount(oracleConfig);
    // swap tokenA and tokenB, change update_authority and disable the config
    const updateOracleConfigAccounts = {
      oracleConfig,
      newTokenAMint: tokenBMint.publicKey,
      newTokenAPrice: ProgramUtil.pythUSDCPriceAccount.address, // swap
      newTokenBPrice: ProgramUtil.pythETHPriceAccount.address, // swap
      newTokenBMint: tokenAMint.publicKey,
    };
    const updateOracleConfigParams = {
      enabled: false,
      source: 0,
      newUpdateAuthority: DripUtil.provider.publicKey,
    };
    await DripUtil.updateOracleConfig(
      updateOracleConfigAccounts,
      updateOracleConfigParams,
      updateAuthority
    );
    const oracleConfigAccountAfter = await AccountUtil.fetchOracleConfigAccount(
      oracleConfig
    );

    oracleConfigAccountAfter.enabled.should.not.equal(
      oracleConfigAccountBefore.enabled
    );
    oracleConfigAccountAfter.enabled.should.equal(
      updateOracleConfigParams.enabled
    );

    oracleConfigAccountAfter.source.should.equal(
      updateOracleConfigParams.source
    );

    oracleConfigAccountAfter.updateAuthority
      .toString()
      .should.not.equal(oracleConfigAccountBefore.updateAuthority.toString());
    oracleConfigAccountAfter.updateAuthority
      .toString()
      .should.equal(updateOracleConfigParams.newUpdateAuthority.toString());

    oracleConfigAccountAfter.tokenAMint
      .toString()
      .should.not.equal(oracleConfigAccountBefore.tokenAMint.toString());
    oracleConfigAccountAfter.tokenAMint
      .toString()
      .should.equal(updateOracleConfigAccounts.newTokenAMint.toString());

    oracleConfigAccountAfter.tokenAPrice
      .toString()
      .should.not.equal(oracleConfigAccountBefore.tokenAPrice.toString());
    oracleConfigAccountAfter.tokenAPrice
      .toString()
      .should.equal(updateOracleConfigAccounts.newTokenAPrice.toString());

    oracleConfigAccountAfter.tokenBMint
      .toString()
      .should.not.equal(oracleConfigAccountBefore.tokenBMint.toString());
    oracleConfigAccountAfter.tokenBMint
      .toString()
      .should.equal(updateOracleConfigAccounts.newTokenBMint.toString());

    oracleConfigAccountAfter.tokenBPrice
      .toString()
      .should.not.equal(oracleConfigAccountBefore.tokenBPrice.toString());
    oracleConfigAccountAfter.tokenBPrice
      .toString()
      .should.equal(updateOracleConfigAccounts.newTokenBPrice.toString());
  });

  it("should throw an error when updating an oracle config that does not exist", async () => {
    const updateOracleConfigAccounts = {
      oracleConfig: generatePair().publicKey,
      newTokenAMint: tokenBMint.publicKey,
      newTokenAPrice: ProgramUtil.pythUSDCPriceAccount.address,
      newTokenBMint: tokenAMint.publicKey,
      newTokenBPrice: ProgramUtil.pythETHPriceAccount.address,
    };
    const updateOracleConfigParams = {
      enabled: false,
      source: 0,
      newUpdateAuthority: DripUtil.provider.publicKey,
    };
    await DripUtil.updateOracleConfig(
      updateOracleConfigAccounts,
      updateOracleConfigParams,
      updateAuthority
    ).should.be.rejectedWith(/0xbc4/);
  });

  it("should throw an error when the updateAuthority does not sign the transaction", async () => {
    const updateOracleConfigAccounts = {
      oracleConfig,
      newTokenAMint: tokenBMint.publicKey,
      newTokenAPrice: ProgramUtil.pythUSDCPriceAccount.address,
      newTokenBMint: tokenAMint.publicKey,
      newTokenBPrice: ProgramUtil.pythETHPriceAccount.address,
    };
    const updateOracleConfigParams = {
      enabled: false,
      source: 0,
      newUpdateAuthority: DripUtil.provider.publicKey,
    };
    await DripUtil.updateOracleConfig(
      updateOracleConfigAccounts,
      updateOracleConfigParams
    ).should.be.rejectedWith(/0x1785/); // SignerIsNotAdmin
  });
}
