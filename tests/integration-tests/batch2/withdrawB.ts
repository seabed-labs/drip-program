import "should";
import { TokenUtil } from "../../utils/token.util";
import {
  depositWithNewUserWrapper,
  sleep,
  dripSPLTokenSwapWrapper,
  withdrawBWrapper,
  DripSPLTokenSwapWrapper,
  WithdrawBWrapper,
  DeployWithNewUserWrapper,
} from "../../utils/setup.util";
import { BN } from "@project-serum/anchor";
import { AccountUtil } from "../../utils/account.util";
import { DeployVaultRes, DripUtil } from "../../utils/drip.util";
import { TokenSwapUtil } from "../../utils/tokenSwapUtil";

describe("#withdrawB", testWithdrawB);

export function testWithdrawB() {
  let deployVaultRes: DeployVaultRes;

  let dripTrigger: DripSPLTokenSwapWrapper;
  let withdrawB: WithdrawBWrapper;
  let depositWithNewUser: DeployWithNewUserWrapper;

  beforeEach(async () => {
    const deploySwapRes = await TokenSwapUtil.deployTokenSwap({});
    deployVaultRes = await DripUtil.deployVaultAndCreatePosition({
      tokenA: deploySwapRes.tokenA,
      tokenB: deploySwapRes.tokenB,
      tokenOwnerKeypair: deploySwapRes.tokenOwnerKeypair,
    });
    dripTrigger = dripSPLTokenSwapWrapper(
      deployVaultRes.botKeypair,
      deployVaultRes.botTokenAAcount,
      deployVaultRes.vault,
      deployVaultRes.vaultProtoConfig,
      deployVaultRes.vaultTokenAAccount,
      deployVaultRes.vaultTokenBAccount,
      deploySwapRes.tokenSwap.poolToken,
      deploySwapRes.tokenSwap.tokenAccountA,
      deploySwapRes.tokenSwap.tokenAccountB,
      deploySwapRes.tokenSwap.feeAccount,
      deploySwapRes.tokenSwap.authority,
      deploySwapRes.tokenSwap.tokenSwap
    );
    withdrawB = withdrawBWrapper(
      deployVaultRes.userKeypair,
      deployVaultRes.vault,
      deployVaultRes.vaultProtoConfig,
      deployVaultRes.userPositionAccount,
      deployVaultRes.userPositionNFTAccount,
      deployVaultRes.vaultTokenBAccount,
      deployVaultRes.vaultTreasuryTokenBAccount,
      deployVaultRes.userTokenBAccount
    );
    depositWithNewUser = depositWithNewUserWrapper(
      deployVaultRes.vault,
      deployVaultRes.tokenOwnerKeypair,
      deployVaultRes.tokenAMint,
      deployVaultRes.vaultTreasuryTokenBAccount
    );
  });

  it("should be able to withdraw in the middle of the drip", async () => {
    const [userTokenBAccountBefore] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
    ]);
    userTokenBAccountBefore.balance.toString().should.equal("0");

    for (let i = 0; i < 2; i++) {
      await dripTrigger(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[i + 1]
      );
      await sleep(1500);
    }

    let [i, j] = [0, 2];
    await withdrawB(
      deployVaultRes.vaultPeriods[i],
      deployVaultRes.vaultPeriods[j]
    );

    const [
      userTokenBAccountAfter,
      vaultTokenBAccountAfter,
      vaultTreasuryTokenBAccountAfter,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(
        deployVaultRes.vaultTreasuryTokenBAccount
      ),
    ]);

    userTokenBAccountAfter.balance.toString().should.equal("496980729");
    vaultTreasuryTokenBAccountAfter.balance.toString().should.equal("995952");
    // The vault token b balance is 1 here, likely due to rounding issues
    vaultTokenBAccountAfter.balance.lt(new BN(10)).should.be.true();
  });

  it("should be able to withdraw at the end of the drip", async () => {
    const [userTokenBAccountBefore] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
    ]);
    userTokenBAccountBefore.balance.toString().should.equal("0");

    for (let i = 0; i < 4; i++) {
      await dripTrigger(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[i + 1]
      );
      await sleep(1500);
    }

    let [i, j] = [0, 4];
    await withdrawB(
      deployVaultRes.vaultPeriods[i],
      deployVaultRes.vaultPeriods[j]
    );

    const [
      userTokenBAccountAfter,
      vaultTokenBAccountAfter,
      vaultTreasuryTokenBAccountAfter,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(
        deployVaultRes.vaultTreasuryTokenBAccount
      ),
    ]);

    userTokenBAccountAfter.balance.toString().should.equal("993911887");
    vaultTreasuryTokenBAccountAfter.balance.toString().should.equal("1991806");
    // The vault token b balance is 1 here, likely due to rounding issues
    vaultTokenBAccountAfter.balance.lt(new BN(10)).should.be.true();
  });

  it("should be able to withdraw in the middle of the drip and at the end", async () => {
    for (let i = 0; i < 2; i++) {
      await dripTrigger(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[i + 1]
      );
      await sleep(1500);
    }
    await withdrawB(
      deployVaultRes.vaultPeriods[0],
      deployVaultRes.vaultPeriods[2]
    );
    let [userTokenBAccountAfter, vaultTreasuryTokenBAccountAfter] =
      await Promise.all([
        TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
        TokenUtil.fetchTokenAccountInfo(
          deployVaultRes.vaultTreasuryTokenBAccount
        ),
      ]);
    userTokenBAccountAfter.balance.toString().should.equal("496980729");
    vaultTreasuryTokenBAccountAfter.balance.toString().should.equal("995952");
    for (let i = 2; i < 4; i++) {
      await dripTrigger(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[i + 1]
      );
      await sleep(1500);
    }
    await withdrawB(
      deployVaultRes.vaultPeriods[0],
      deployVaultRes.vaultPeriods[4]
    );
    [userTokenBAccountAfter, vaultTreasuryTokenBAccountAfter] =
      await Promise.all([
        TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
        TokenUtil.fetchTokenAccountInfo(
          deployVaultRes.vaultTreasuryTokenBAccount
        ),
      ]);
    // Diff of 1 from previous test due to rounding issues since we always round down
    userTokenBAccountAfter.balance.toString().should.equal("993911887");
    vaultTreasuryTokenBAccountAfter.balance.toString().should.equal("1991806");
  });

  it("should not be able to withdraw twice in the same period", async () => {
    await depositWithNewUser({
      mintAmount: 3,
      numberOfCycles: 2,
      newUserEndVaultPeriod: deployVaultRes.vaultPeriods[2],
    });
    for (let i = 0; i < 2; i++) {
      await dripTrigger(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[i + 1]
      );
      await sleep(1500);
    }
    let [i, j] = [0, 2];
    const [userTokenBAccountBefore, userPositionAccountBefore] =
      await Promise.all([
        TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
        AccountUtil.fetchPositionAccount(deployVaultRes.userPositionAccount),
      ]);
    userTokenBAccountBefore.balance.toString().should.equal("0");
    userPositionAccountBefore.withdrawnTokenBAmount
      .toString()
      .should.equal("0");
    await withdrawB(
      deployVaultRes.vaultPeriods[i],
      deployVaultRes.vaultPeriods[j]
    );
    let [userTokenBAccountAfter, userPositionAccountAfter] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
      AccountUtil.fetchPositionAccount(deployVaultRes.userPositionAccount),
    ]);
    userTokenBAccountAfter.balance.toString().should.equal("496832171");
    userPositionAccountAfter.withdrawnTokenBAmount
      .toString()
      .should.equal("497827825");
    await withdrawB(
      deployVaultRes.vaultPeriods[i],
      deployVaultRes.vaultPeriods[j]
    ).should.be.rejectedWith(/0x1780/);
  });

  it("should not be able to withdraw when withdrawable amount is 0", async () => {
    let [i, j] = [0, 0];
    await withdrawB(
      deployVaultRes.vaultPeriods[i],
      deployVaultRes.vaultPeriods[j]
    ).should.be.rejectedWith(/0x1780/);
  });
}
