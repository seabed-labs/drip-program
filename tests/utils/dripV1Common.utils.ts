import { GenericDripWrapper, sleep } from "./setup.util";
import { DeployVaultRes, DripUtil } from "./drip.util";
import { generatePair } from "./common.util";
import { PublicKey } from "@solana/web3.js";
import { ProgramUtil } from "./program.util";
import { TokenUtil } from "./token.util";
import { AccountUtil } from "./account.util";

export type DripV1CommonSetup = () => Promise<{
  dripWithWhitelistedSwap: GenericDripWrapper;
  dripWithNonWhitelistedSwap: GenericDripWrapper;
  deployVaultABRes: DeployVaultRes;
  deployVaultBARes: DeployVaultRes;
}>;
export function testV1DripCommon(setup: DripV1CommonSetup) {
  describe("test common dripV1 validations and logic", function () {
    let dripWithWhitelistedSwap: GenericDripWrapper;
    let dripWithNonWhitelistedSwap: GenericDripWrapper;
    let deployVaultABRes: DeployVaultRes;
    let deployVaultBARes: DeployVaultRes;

    beforeEach(async function () {
      await sleep(500);
      const setupRes = await setup();
      deployVaultABRes = setupRes.deployVaultABRes;
      deployVaultBARes = setupRes.deployVaultBARes;
      dripWithWhitelistedSwap = setupRes.dripWithWhitelistedSwap;
      dripWithNonWhitelistedSwap = setupRes.dripWithNonWhitelistedSwap;
    });

    it("should trigger once for vault AB", async () => {
      let [
        vaultTokenAAccountBefore,
        vaultTokenBAccountBefore,
        botTokenAAccountBefore,
        vaultBefore,
        period0Before,
        period1Before,
      ] = await Promise.all([
        TokenUtil.fetchTokenAccountInfo(deployVaultABRes.vaultTokenAAccount),
        TokenUtil.fetchTokenAccountInfo(deployVaultABRes.vaultTokenBAccount),
        TokenUtil.fetchTokenAccountInfo(deployVaultABRes.botTokenAAcount),
        AccountUtil.fetchVaultAccount(deployVaultABRes.vault),
        AccountUtil.fetchVaultPeriodAccount(deployVaultABRes.vaultPeriods[0]),
        AccountUtil.fetchVaultPeriodAccount(deployVaultABRes.vaultPeriods[1]),
      ]);
      botTokenAAccountBefore.balance.toString().should.equal("0");
      vaultBefore.lastDripPeriod
        .toNumber()
        .should.equal(period0Before.periodId.toNumber());

      await dripWithWhitelistedSwap(
        deployVaultABRes,
        deployVaultABRes.vaultPeriods[0],
        deployVaultABRes.vaultPeriods[1]
      );

      let [
        vaultTokenAAccountAfter,
        vaultTokenBAccountAfter,
        botTokenAAccountAfter,
        vaultAfter,
        period0After,
        period1After,
      ] = await Promise.all([
        TokenUtil.fetchTokenAccountInfo(deployVaultABRes.vaultTokenAAccount),
        TokenUtil.fetchTokenAccountInfo(deployVaultABRes.vaultTokenBAccount),
        TokenUtil.fetchTokenAccountInfo(deployVaultABRes.botTokenAAcount),
        AccountUtil.fetchVaultAccount(deployVaultABRes.vault),
        AccountUtil.fetchVaultPeriodAccount(deployVaultABRes.vaultPeriods[0]),
        AccountUtil.fetchVaultPeriodAccount(deployVaultABRes.vaultPeriods[1]),
      ]);
      vaultTokenAAccountBefore.balance
        .gt(vaultTokenAAccountAfter.balance)
        .should.be.true();
      vaultTokenBAccountBefore.balance
        .lt(vaultTokenBAccountAfter.balance)
        .should.be.true();
      botTokenAAccountBefore.balance
        .lt(botTokenAAccountAfter.balance)
        .should.be.true();
      period0Before.twap.lt(period0After.twap).should.be.false();
      period1Before.twap.lt(period1After.twap).should.be.true();
      vaultAfter.lastDripPeriod
        .toNumber()
        .should.equal(period1After.periodId.toNumber());

      await dripWithWhitelistedSwap(
        deployVaultBARes,
        deployVaultBARes.vaultPeriods[0],
        deployVaultBARes.vaultPeriods[1]
      );
    });

    it("should trigger once for vault BA", async () => {
      let [
        vaultTokenAAccountBefore,
        vaultTokenBAccountBefore,
        botTokenAAccountBefore,
        vaultBefore,
        period0Before,
        period1Before,
      ] = await Promise.all([
        TokenUtil.fetchTokenAccountInfo(deployVaultBARes.vaultTokenAAccount),
        TokenUtil.fetchTokenAccountInfo(deployVaultBARes.vaultTokenBAccount),
        TokenUtil.fetchTokenAccountInfo(deployVaultBARes.botTokenAAcount),
        AccountUtil.fetchVaultAccount(deployVaultBARes.vault),
        AccountUtil.fetchVaultPeriodAccount(deployVaultBARes.vaultPeriods[0]),
        AccountUtil.fetchVaultPeriodAccount(deployVaultBARes.vaultPeriods[1]),
      ]);
      botTokenAAccountBefore.balance.toString().should.equal("0");
      vaultBefore.lastDripPeriod
        .toNumber()
        .should.equal(period0Before.periodId.toNumber());

      await dripWithWhitelistedSwap(
        deployVaultBARes,
        deployVaultBARes.vaultPeriods[0],
        deployVaultBARes.vaultPeriods[1]
      );

      let [
        vaultTokenAAccountAfter,
        vaultTokenBAccountAfter,
        botTokenAAccountAfter,
        vaultAfter,
        period0After,
        period1After,
      ] = await Promise.all([
        TokenUtil.fetchTokenAccountInfo(deployVaultBARes.vaultTokenAAccount),
        TokenUtil.fetchTokenAccountInfo(deployVaultBARes.vaultTokenBAccount),
        TokenUtil.fetchTokenAccountInfo(deployVaultBARes.botTokenAAcount),
        AccountUtil.fetchVaultAccount(deployVaultBARes.vault),
        AccountUtil.fetchVaultPeriodAccount(deployVaultBARes.vaultPeriods[0]),
        AccountUtil.fetchVaultPeriodAccount(deployVaultBARes.vaultPeriods[1]),
      ]);
      vaultTokenAAccountBefore.balance
        .gt(vaultTokenAAccountAfter.balance)
        .should.be.true();
      vaultTokenBAccountBefore.balance
        .lt(vaultTokenBAccountAfter.balance)
        .should.be.true();
      botTokenAAccountBefore.balance
        .lt(botTokenAAccountAfter.balance)
        .should.be.true();
      period0Before.twap.lt(period0After.twap).should.be.false();
      period1Before.twap.lt(period1After.twap).should.be.true();
      vaultAfter.lastDripPeriod
        .toNumber()
        .should.equal(period1After.periodId.toNumber());
    });

    it("should fail to trigger drip if vault token A balance is 0", async () => {
      const deployEmptyVaultRes = await DripUtil.deployVault({
        tokenA: deployVaultABRes.tokenAMint,
        tokenB: deployVaultABRes.tokenBMint,
        tokenOwnerKeypair: deployVaultABRes.tokenOwnerKeypair,
        shouldCreateUserPosition: false,
      });
      await dripWithWhitelistedSwap(
        deployEmptyVaultRes,
        deployEmptyVaultRes.vaultPeriods[0],
        deployEmptyVaultRes.vaultPeriods[1]
      ).should.be.rejectedWith(/0x177e/); // PeriodicDripAmountIsZero
    });

    it("should fail when attempting to drip twice in the same granularity", async function () {
      await dripWithWhitelistedSwap(
        deployVaultABRes,
        deployVaultABRes.vaultPeriods[0],
        deployVaultABRes.vaultPeriods[1]
      );
      await dripWithWhitelistedSwap(
        deployVaultABRes,
        deployVaultABRes.vaultPeriods[1],
        deployVaultABRes.vaultPeriods[2]
      ).should.be.rejectedWith(/1773/); // DuplicateDripError
    });

    it("should fail if non-whitelisted swap is used", async function () {
      await dripWithNonWhitelistedSwap(
        deployVaultABRes,
        deployVaultABRes.vaultPeriods[0],
        deployVaultABRes.vaultPeriods[1]
      ).should.be.rejectedWith(/0x1778/); // InvalidSwapAccount
    });

    it("should throw an error if the vault has an oracle config defined", async function () {
      const oracleConfig = generatePair();
      await DripUtil.initOracleConfig(
        {
          oracleConfig: oracleConfig,
          tokenAMint: deployVaultABRes.tokenAMint.publicKey,
          tokenAPrice: new PublicKey(ProgramUtil.pythETHPriceAccount.address),
          tokenBMint: deployVaultABRes.tokenBMint.publicKey,
          tokenBPrice: new PublicKey(ProgramUtil.pythUSDCPriceAccount.address),
          creator: deployVaultABRes.admin,
        },
        {
          enabled: true,
          source: 0,
          updateAuthority: deployVaultABRes.admin.publicKey,
        }
      );
      await DripUtil.setVaultOracleConfig({
        admin: deployVaultABRes.admin,
        vault: deployVaultABRes.vault,
        vaultProtoConfig: deployVaultABRes.vaultProtoConfig,
        newOracleConfig: oracleConfig.publicKey,
      });
      await dripWithWhitelistedSwap(
        deployVaultABRes,
        deployVaultABRes.vaultPeriods[0],
        deployVaultABRes.vaultPeriods[1]
      ).should.be.rejectedWith(/0x178b/);
    });

    it("should trigger drip number_of_cycles number of times", async () => {
      const position = await AccountUtil.fetchPositionAccount(
        deployVaultABRes.userPositionAccount
      );
      position.numberOfSwaps.toNumber().should.not.equal(0);
      for (let i = 0; i < position.numberOfSwaps.toNumber(); i++) {
        await dripWithWhitelistedSwap(
          deployVaultABRes,
          deployVaultABRes.vaultPeriods[i],
          deployVaultABRes.vaultPeriods[i + 1]
        );
        await sleep(1500);
      }
      const [
        vaultTokenAAccountAfter,
        vaultTokenBAccountAfter,
        botTokenAAccountAfter,
      ] = await Promise.all([
        TokenUtil.fetchTokenAccountInfo(deployVaultABRes.vaultTokenAAccount),
        TokenUtil.fetchTokenAccountInfo(deployVaultABRes.vaultTokenBAccount),
        TokenUtil.fetchTokenAccountInfo(deployVaultABRes.botTokenAAcount),
      ]);
      vaultTokenAAccountAfter.balance.toNumber().should.be.lessThan(10);
    });
  });
}
