import "should";
import { AccountUtil } from "../../utils/account.util";
import { DripUtil } from "../../utils/drip.util";
import { generatePair, generatePairs } from "../../utils/common.util";
import { Keypair, PublicKey, Signer } from "@solana/web3.js";
import { SolUtil } from "../../utils/sol.util";
import { ProgramUtil } from "../../utils/program.util";
import { key } from "../../utils/mocks/mockAdminKeypair";

describe("#v1ToV2Migration", v1ToV2Migration);

function v1ToV2Migration() {
  const vault = new PublicKey("CZbTusYjrRtjKqeZQXtoH26tNcx5HVV4kn5vB7kLPS1e");
  const vaultProtoConfig = new PublicKey(
    "13QUGbPGEPbGPgYqoMrCnkG8iKw61uAtCFRoXu21eM2a"
  );
  const admin = Keypair.fromSecretKey(Uint8Array.from(key));

  let newOracleConfig: PublicKey;
  before(async () => {
    await SolUtil.fundAccount(admin.publicKey, SolUtil.solToLamports(0.5));

    const oracleConfigKeypair = generatePair();
    const accounts = {
      oracleConfig: oracleConfigKeypair,
      tokenAMint: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
      tokenAPrice: new PublicKey(ProgramUtil.pythUSDCPriceAccount.address),
      tokenBMint: new PublicKey("7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs"),
      tokenBPrice: ProgramUtil.pythETHPriceAccount.address,
      creator: admin,
    };
    const params = {
      enabled: true,
      source: 0,
      updateAuthority: admin.publicKey,
    };
    await DripUtil.initOracleConfig(accounts, params);
    newOracleConfig = oracleConfigKeypair.publicKey;
  });

  it("should read, parse and update a v1 vault with an oracle config and maxPriceDeviationBps", async () => {
    const vaultBefore = await AccountUtil.fetchVaultAccount(vault);
    await DripUtil.setVaultMaxPriceDeviationBps(
      {
        maxPriceDeviation: 1000,
      },
      {
        admin,
        vault,
        vaultProtoConfig,
      }
    );
    await DripUtil.setVaultOracleConfig({
      admin,
      vault,
      vaultProtoConfig,
      newOracleConfig,
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
    vaultAfter.oracleConfig.toString().should.equal(newOracleConfig.toString());
    vaultAfter.bump.should.equal(vaultBefore.bump);
    vaultAfter.limitSwaps.should.equal(vaultBefore.limitSwaps);
    vaultAfter.maxSlippageBps.should.equal(vaultBefore.maxSlippageBps);

    vaultAfter.maxPriceDeviationBps
      .toString()
      .should.not.equal(vaultBefore.maxPriceDeviationBps.toString());
    vaultAfter.maxPriceDeviationBps.toString().should.equal("1000");
  });
}
