import "should";
import { AccountUtil } from "../../utils/account.util";
import { DripUtil } from "../../utils/drip.util";
import { generatePair, generatePairs } from "../../utils/common.util";
import { Keypair, PublicKey, Signer } from "@solana/web3.js";
import { SolUtil } from "../../utils/sol.util";
import { ProgramUtil } from "../../utils/program.util";

describe("#setVaultMaxPriceDeviationBps", setVaultMaxPriceDeviationBps);

function setVaultMaxPriceDeviationBps() {
  let vault: PublicKey;
  let vaultProtoConfig: PublicKey;
  let admin: Keypair | Signer;

  beforeEach(async () => {
    const res = await DripUtil.deployVault({
      shouldCreateUserPosition: false,
    });
    vault = res.vault;
    vaultProtoConfig = res.vaultProtoConfig;
    admin = res.admin;
  });

  it("should update the maxPriceDeviation to provided input if admin signs the transaction", async () => {
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
    vaultAfter.oracleConfig
      .toString()
      .should.equal(vaultBefore.oracleConfig.toString());
    vaultAfter.bump.should.equal(vaultBefore.bump);
    vaultAfter.limitSwaps.should.equal(vaultBefore.limitSwaps);
    vaultAfter.maxSlippageBps.should.equal(vaultBefore.maxSlippageBps);

    vaultAfter.maxPriceDeviationBps
      .toString()
      .should.not.equal(vaultBefore.maxPriceDeviationBps.toString());
    vaultAfter.maxPriceDeviationBps.toString().should.equal("1000");
  });

  it("should display idempotent behaviour when setting maxPriceDeviationBps", async () => {
    const vaultBefore = await AccountUtil.fetchVaultAccount(vault);
    vaultBefore.maxPriceDeviationBps.toString().should.equal("0");
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
    let vaultAfter = await AccountUtil.fetchVaultAccount(vault);
    vaultAfter.maxPriceDeviationBps.toString().should.equal("1000");
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
    vaultAfter = await AccountUtil.fetchVaultAccount(vault);
    vaultAfter.maxPriceDeviationBps.toString().should.equal("1000");
  });

  it("should throw an error a non-admin tries to update the maxPriceDeviationBps", async () => {
    await DripUtil.setVaultMaxPriceDeviationBps(
      {
        maxPriceDeviation: 0,
      },
      {
        admin: undefined,
        vault,
        vaultProtoConfig,
      }
    ).should.be.rejectedWith(/0x1785/); // SignerIsNotAdmin
  });
}
