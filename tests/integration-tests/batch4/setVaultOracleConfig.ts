import "should";
import { AccountUtil } from "../../utils/account.util";
import { DripUtil } from "../../utils/drip.util";
import { generatePair, generatePairs } from "../../utils/common.util";
import { Keypair, PublicKey, Signer } from "@solana/web3.js";
import { SolUtil } from "../../utils/sol.util";
import { ProgramUtil } from "../../utils/program.util";

describe("#setVaultOracleConfig", setVaultOracleConfig);

function setVaultOracleConfig() {
  let vault: PublicKey;
  let vaultProtoConfig: PublicKey;
  let oracleConfig: PublicKey;
  let admin: Keypair | Signer;

  beforeEach(async () => {
    const payerKeypair = generatePair();
    await Promise.all([
      SolUtil.fundAccount(payerKeypair.publicKey, SolUtil.solToLamports(0.1)),
    ]);
    const res = await DripUtil.deployVaultAndCreatePosition({});
    const oracleConfigKeypair = generatePair();
    const updateAuthority = generatePair();
    const accounts = {
      oracleConfig: oracleConfigKeypair,
      tokenAMint: res.tokenAMint.publicKey,
      tokenAPrice: new PublicKey(ProgramUtil.pythETHPriceAccount.address),
      tokenBMint: res.tokenBMint.publicKey,
      tokenBPrice: ProgramUtil.pythUSDCPriceAccount.address,
      creator: payerKeypair,
    };
    const params = {
      enabled: true,
      source: 0,
      updateAuthority: updateAuthority.publicKey,
    };
    await DripUtil.initOracleConfig(accounts, params);

    vault = res.vault;
    vaultProtoConfig = res.vaultProtoConfig;
    oracleConfig = oracleConfigKeypair.publicKey;
    admin = res.admin;
  });

  it("should update the oracle account to provided input if admin signs the transaction", async () => {
    const vaultBefore = await AccountUtil.fetchVaultAccount(vault);
    await DripUtil.setVaultOracleConfig({
      admin,
      vault,
      vaultProtoConfig,
      newOracleConfig: oracleConfig,
    });
    const vaultAfter = await AccountUtil.fetchVaultAccount(vault);

    vaultAfter.protoConfig
      .toBase58()
      .should.equal(vaultBefore.protoConfig.toBase58());
    vaultAfter.tokenAMint
      .toBase58()
      .should.equal(vaultBefore.tokenAMint.toBase58());
    vaultAfter.tokenBMint
      .toBase58()
      .should.equal(vaultBefore.tokenBMint.toBase58());
    vaultAfter.tokenAAccount
      .toBase58()
      .should.equal(vaultBefore.tokenAAccount.toBase58());
    vaultAfter.tokenBAccount
      .toBase58()
      .should.equal(vaultBefore.tokenBAccount.toBase58());
    vaultAfter.treasuryTokenBAccount
      .toBase58()
      .should.equal(vaultBefore.treasuryTokenBAccount.toBase58());
    vaultAfter.whitelistedSwaps
      .map((el) => el.toBase58())
      .sort()
      .should.deepEqual(
        vaultBefore.whitelistedSwaps.map((el) => el.toBase58()).sort()
      );
    vaultAfter.lastDripPeriod
      .toString()
      .should.equal(vaultBefore.lastDripPeriod.toString());
    vaultAfter.dripAmount
      .toString()
      .should.equal(vaultBefore.dripAmount.toString());
    vaultAfter.dripActivationTimestamp
      .toString()
      .should.equal(vaultBefore.dripActivationTimestamp.toString());
    vaultAfter.bump.should.equal(vaultBefore.bump);
    vaultAfter.limitSwaps.should.equal(vaultBefore.limitSwaps);
    vaultAfter.maxSlippageBps.should.equal(vaultBefore.maxSlippageBps);

    vaultAfter.oracleConfig
      .toBase58()
      .should.not.equal(vaultBefore.oracleConfig.toBase58());
    vaultAfter.oracleConfig.toBase58().should.equal(oracleConfig.toBase58());
  });

  it("should be able to set oracle config 2 times", async () => {
    await DripUtil.setVaultOracleConfig({
      admin,
      vault,
      vaultProtoConfig,
      newOracleConfig: oracleConfig,
    });
    await DripUtil.setVaultOracleConfig({
      admin,
      vault,
      vaultProtoConfig,
      newOracleConfig: oracleConfig,
    });
    const vaultAfter = await AccountUtil.fetchVaultAccount(vault);
    vaultAfter.oracleConfig.toBase58().should.equal(oracleConfig.toBase58());
  });

  it("should throw an error a non-admin tries to update the oracle config", async () => {
    await DripUtil.setVaultOracleConfig({
      admin: undefined,
      vault,
      vaultProtoConfig,
      newOracleConfig: oracleConfig,
    }).should.be.rejectedWith(/0x1785/); // SignerIsNotAdmin
  });
}
