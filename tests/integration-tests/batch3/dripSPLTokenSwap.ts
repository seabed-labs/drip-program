import "should";
import { TokenUtil } from "../../utils/token.util";
import { generatePair } from "../../utils/common.util";
import {
  sleep,
  dripSPLTokenSwapWrapper,
  DripSPLTokenSwapWrapper,
} from "../../utils/setup.util";
import { PublicKey } from "@solana/web3.js";
import { AccountUtil } from "../../utils/account.util";
import { DeployVaultRes, DripUtil } from "../../utils/drip.util";
import { ProgramUtil } from "../../utils/program.util";
import { TokenSwapUtil } from "../../utils/tokenSwapUtil";

describe("#dripSPLTokenSwap", testDripSPLTokenSwap);

export function testDripSPLTokenSwap() {
  let deployVaultRes: DeployVaultRes;
  // whitelisted a -> b
  let dripWithSwap1: DripSPLTokenSwapWrapper;
  // whitelisted b -> a
  let dripWithSwap2: DripSPLTokenSwapWrapper;
  // non-whitelisted a -> b
  let dripWithSwap3: DripSPLTokenSwapWrapper;

  beforeEach(async () => {
    const deploySwap1Res = await TokenSwapUtil.deployTokenSwap({});
    const [deploySwap2Res, deploySwap3Res] = await Promise.all([
      TokenSwapUtil.deployTokenSwap({
        tokenA: deploySwap1Res.tokenB,
        tokenB: deploySwap1Res.tokenA,
        tokenOwnerKeypair: deploySwap1Res.tokenOwnerKeypair,
      }),
      TokenSwapUtil.deployTokenSwap({
        tokenA: deploySwap1Res.tokenA,
        tokenB: deploySwap1Res.tokenB,
        tokenOwnerKeypair: deploySwap1Res.tokenOwnerKeypair,
      }),
    ]);
    deployVaultRes = await DripUtil.deployVaultAndCreatePosition({
      tokenA: deploySwap1Res.tokenA,
      tokenB: deploySwap1Res.tokenB,
      tokenOwnerKeypair: deploySwap1Res.tokenOwnerKeypair,
      whitelistedSwaps: [
        deploySwap1Res.tokenSwap.tokenSwap,
        deploySwap2Res.tokenSwap.tokenSwap,
      ],
    });

    dripWithSwap1 = dripSPLTokenSwapWrapper(
      deployVaultRes.botKeypair,
      deployVaultRes.botTokenAAcount,
      deployVaultRes.vault,
      deployVaultRes.vaultProtoConfig,
      deployVaultRes.vaultTokenAAccount,
      deployVaultRes.vaultTokenBAccount,
      deploySwap1Res.tokenSwap.poolToken,
      deploySwap1Res.tokenSwap.tokenAccountA,
      deploySwap1Res.tokenSwap.tokenAccountB,
      deploySwap1Res.tokenSwap.feeAccount,
      deploySwap1Res.tokenSwap.authority,
      deploySwap1Res.tokenSwap.tokenSwap
    );

    // swap2 has tokenA and tokenB swapped from swap1
    // so here we are swapping the tokenAccounts (this is how tokenSwap facilitates a -> b and b ->a for the same swap)
    dripWithSwap2 = dripSPLTokenSwapWrapper(
      deployVaultRes.botKeypair,
      deployVaultRes.botTokenAAcount,
      deployVaultRes.vault,
      deployVaultRes.vaultProtoConfig,
      deployVaultRes.vaultTokenAAccount,
      deployVaultRes.vaultTokenBAccount,
      deploySwap2Res.tokenSwap.poolToken,
      deploySwap2Res.tokenSwap.tokenAccountB,
      deploySwap2Res.tokenSwap.tokenAccountA,
      deploySwap2Res.tokenSwap.feeAccount,
      deploySwap2Res.tokenSwap.authority,
      deploySwap2Res.tokenSwap.tokenSwap
    );

    // non-whitelisted swap
    dripWithSwap3 = dripSPLTokenSwapWrapper(
      deployVaultRes.botKeypair,
      deployVaultRes.botTokenAAcount,
      deployVaultRes.vault,
      deployVaultRes.vaultProtoConfig,
      deployVaultRes.vaultTokenAAccount,
      deployVaultRes.vaultTokenBAccount,
      deploySwap3Res.tokenSwap.poolToken,
      deploySwap3Res.tokenSwap.tokenAccountA,
      deploySwap3Res.tokenSwap.tokenAccountB,
      deploySwap3Res.tokenSwap.feeAccount,
      deploySwap3Res.tokenSwap.authority,
      deploySwap3Res.tokenSwap.tokenSwap
    );
  });

  it("should trigger drip twice with expected TWAP and Balance values", async () => {
    await dripWithSwap1(
      deployVaultRes.vaultPeriods[0],
      deployVaultRes.vaultPeriods[1]
    );

    let [
      vaultTokenAAccountAfter,
      vaultTokenBAccountAfter,
      botTokenAAccountAfter,
      vaultAfter,
      lastVaultPeriod,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.botTokenAAcount),
      AccountUtil.fetchVaultAccount(deployVaultRes.vault),
      AccountUtil.fetchVaultPeriodAccount(deployVaultRes.vaultPeriods[1]),
    ]);

    vaultAfter.lastDripPeriod.toString().should.equal("1");
    vaultTokenAAccountAfter.balance.toString().should.equal("750000000");
    vaultTokenBAccountAfter.balance.toString().should.equal("248994550");
    botTokenAAccountAfter.balance.toString().should.equal("250000");
    lastVaultPeriod.twap.toString().should.equal("18390945904298204746");
    lastVaultPeriod.dripTimestamp.toString().should.not.equal("0");

    await sleep(1500);
    await dripWithSwap1(
      deployVaultRes.vaultPeriods[1],
      deployVaultRes.vaultPeriods[2]
    );

    [
      vaultTokenAAccountAfter,
      vaultTokenBAccountAfter,
      botTokenAAccountAfter,
      vaultAfter,
      lastVaultPeriod,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.botTokenAAcount),
      AccountUtil.fetchVaultAccount(deployVaultRes.vault),
      AccountUtil.fetchVaultPeriodAccount(deployVaultRes.vaultPeriods[2]),
    ]);

    vaultAfter.lastDripPeriod.toString().should.equal("2");
    vaultTokenAAccountAfter.balance.toString().should.equal("500000000");
    vaultTokenBAccountAfter.balance.toString().should.equal("497976682");
    botTokenAAccountAfter.balance.toString().should.equal("500000");
    lastVaultPeriod.twap.toString().should.equal("18390487302360452343");
  });

  it("should trigger drip with inverted swap", async () => {
    await dripWithSwap2(
      deployVaultRes.vaultPeriods[0],
      deployVaultRes.vaultPeriods[1]
    );
  });

  it("should trigger drip number_of_cycles number of times", async () => {
    for (let i = 0; i < 4; i++) {
      await dripWithSwap1(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[i + 1]
      );
      await sleep(1500);
    }

    const [
      vaultTokenAAccountAfter,
      vaultTokenBAccountAfter,
      botTokenAAccountAfter,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.botTokenAAcount),
    ]);
    vaultTokenAAccountAfter.balance.toString().should.equal("0");
    vaultTokenBAccountAfter.balance.toString().should.equal("995903694");
    botTokenAAccountAfter.balance.toString().should.equal("1000000");
  });

  it("should fail to trigger drip if vault token A balance is 0", async () => {
    for (let i = 0; i < 4; i++) {
      await dripWithSwap1(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[i + 1]
      );
      await sleep(1500);
    }
    await dripWithSwap1(
      deployVaultRes.vaultPeriods[4],
      deployVaultRes.vaultPeriods[5]
    ).should.be.rejectedWith(/0x177e/); // PeriodicDripAmountIsZero
  });

  it("should fail if we trigger twice in the same granularity", async () => {
    await dripWithSwap1(
      deployVaultRes.vaultPeriods[0],
      deployVaultRes.vaultPeriods[1]
    );
    await dripWithSwap1(
      deployVaultRes.vaultPeriods[1],
      deployVaultRes.vaultPeriods[2]
    ).should.be.rejectedWith(/1773/); // DuplicateDripError
  });

  it("should fail if non-whitelisted swaps is used", async () => {
    await dripWithSwap3(
      deployVaultRes.vaultPeriods[0],
      deployVaultRes.vaultPeriods[1]
    ).should.be.rejectedWith(/0x1778/); // InvalidSwapAccount
  });

  it("should throw an error if the vault has an oracle config defined", async () => {
    const oracleConfig = generatePair();
    await DripUtil.initOracleConfig(
      {
        oracleConfig: oracleConfig,
        tokenAMint: deployVaultRes.tokenAMint.publicKey,
        tokenAPrice: new PublicKey(ProgramUtil.pythETHPriceAccount.address),
        tokenBMint: deployVaultRes.tokenBMint.publicKey,
        tokenBPrice: new PublicKey(ProgramUtil.pythUSDCPriceAccount.address),
        creator: deployVaultRes.admin,
      },
      {
        enabled: true,
        source: 0,
        updateAuthority: deployVaultRes.admin.publicKey,
      }
    );
    await DripUtil.setVaultOracleConfig({
      admin: deployVaultRes.admin,
      vault: deployVaultRes.vault,
      vaultProtoConfig: deployVaultRes.vaultProtoConfig,
      newOracleConfig: oracleConfig.publicKey,
    });
    await dripWithSwap1(
      deployVaultRes.vaultPeriods[0],
      deployVaultRes.vaultPeriods[1]
    ).should.be.rejectedWith(/0x178b/);
  });
}
