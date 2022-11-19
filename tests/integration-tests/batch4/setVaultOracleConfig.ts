import "should";
import { AccountUtil } from "../../utils/account.util";
import { DripUtil } from "../../utils/drip.util";
import {
  generatePair,
} from "../../utils/common.util";
import { Keypair, PublicKey, Signer } from "@solana/web3.js";

describe("#initOracleConfig", testInitOracleConfig);

export function testInitOracleConfig() {
  let vault: PublicKey;
  let vaultProtoConfig: PublicKey;
  let oracleConfig: PublicKey;
  let admin: Keypair | Signer;

  beforeEach( async () => {
    const res = await DripUtil.deployVault({})
    const oracleConfigKeypair = generatePair();
    const updateAuthority = generatePair();
    const accounts = {
      oracleConfig: oracleConfigKeypair,
      tokenAMint: res.tokenAMint.publicKey,
      tokenAPrice: new PublicKey(
        "JBu1AL4obBcCMqKBBxhpWCNUt136ijcuMZLFvTP7iWdB"
      ),
      tokenBMint: res.tokenBMint.publicKey,
      tokenBPrice: new PublicKey(
        "Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD"
      ),
      creator: updateAuthority,
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
    const vaultBefore = await AccountUtil.fetchVaultAccount(
      vault
    );
    await DripUtil.setVaultOracleConfig({
      admin,
      vault,
      vaultProtoConfig,
    }, {
      oracleConfig,
    });
    const vaultAfter = await AccountUtil.fetchVaultAccount(
     vault
    );

    vaultAfter.protoConfig.toBase58().should.equal(vaultBefore.protoConfig.toBase58());
    vaultAfter.tokenAMint.toBase58().should.equal(vaultBefore.tokenAMint.toBase58());
    vaultAfter.tokenBMint.toBase58().should.equal(vaultBefore.tokenBMint.toBase58());
    vaultAfter.tokenAAccount.toBase58().should.equal(vaultBefore.tokenAAccount.toBase58());
    vaultAfter.tokenBAccount.toBase58().should.equal(vaultBefore.tokenBAccount.toBase58());
    vaultAfter.treasuryTokenBAccount.toBase58().should.equal(vaultBefore.treasuryTokenBAccount.toBase58());
    vaultAfter.whitelistedSwaps.should.containEql(vaultBefore.whitelistedSwaps);
    vaultAfter.lastDripPeriod.should.equal(vaultBefore.lastDripPeriod);
    vaultAfter.dripAmount.should.equal(vaultBefore.dripAmount);
    vaultAfter.dripActivationTimestamp.should.equal(vaultBefore.dripActivationTimestamp);
    vaultAfter.bump.should.equal(vaultBefore.bump);
    vaultAfter.limitSwaps.should.equal(vaultBefore.limitSwaps);
    vaultAfter.maxSlippageBps.should.equal(vaultBefore.maxSlippageBps);

    vaultAfter.oracleConfig.toBase58().should.not.equal(vaultBefore.oracleConfig.toBase58());
    vaultAfter.oracleConfig.toBase58.should.equal(oracleConfig.toBase58());
  });

  // it("should throw an error when an invalid source is passed in", async () => {
  //
  // });
  //
  // it("should throw an error when token_a_price cannot be decoded correctly", async () => {
  //
  // });
  //
  // it("should throw an error when token_b_price cannot be decoded correctly", async () => {
  //
  // });
}
