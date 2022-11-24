import "should";
import { TokenUtil } from "../../utils/token.util";
import { generatePair } from "../../utils/common.util";
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
import { DeployVaultRes, DripUtil } from "../../utils/drip.util";
import { TokenSwapUtil } from "../../utils/tokenSwapUtil";

describe("#withdrawBWithReferrer", testWithdrawB);

export function testWithdrawB() {
  let deployVaultRes: DeployVaultRes;
  let dripTrigger: DripSPLTokenSwapWrapper;
  let withdrawB: WithdrawBWrapper;
  let depositWithNewUser: DeployWithNewUserWrapper;

  beforeEach(async () => {
    const deploySwapRes = await TokenSwapUtil.deployTokenSwap({});
    const referrerWallet = generatePair().publicKey;
    const referrerTokenBAccount =
      await deploySwapRes.tokenB.createAssociatedTokenAccount(referrerWallet);
    deployVaultRes = await DripUtil.deployVaultAndCreatePosition({
      tokenA: deploySwapRes.tokenA,
      tokenB: deploySwapRes.tokenB,
      tokenOwnerKeypair: deploySwapRes.tokenOwnerKeypair,
      referrerTokenBAccount,
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
      deployVaultRes.userTokenBAccount,
      referrerTokenBAccount
    );
    depositWithNewUser = depositWithNewUserWrapper(
      deployVaultRes.vault,
      deployVaultRes.tokenOwnerKeypair,
      deployVaultRes.tokenAMint,
      referrerTokenBAccount
    );
  });

  it("should be able to withdraw in the middle of the drip", async () => {
    const [userTokenBAccountBefore] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
    ]);

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
      referrerTokenBAccountAfter,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(
        deployVaultRes.vaultTreasuryTokenBAccount
      ),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.referrerTokenBAccount),
    ]);

    userTokenBAccountAfter.balance.toString().should.equal("496980729");
    vaultTreasuryTokenBAccountAfter.balance.toString().should.equal("497976");
    referrerTokenBAccountAfter.balance.toString().should.equal("497976");
    // The vault token b balance is 1 here, likely due to rounding issues
    vaultTokenBAccountAfter.balance.lt(new BN(10)).should.be.true();
  });

  it("should be able to withdraw at the end of the drip", async () => {
    const [userTokenBAccountBefore] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
    ]);

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
      referrerTokenBAccountAfter,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(
        deployVaultRes.vaultTreasuryTokenBAccount
      ),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.referrerTokenBAccount),
    ]);

    userTokenBAccountAfter.balance.toString().should.equal("993911887");
    vaultTreasuryTokenBAccountAfter.balance.toString().should.equal("995903");
    referrerTokenBAccountAfter.balance.toString().should.equal("995903");
    // The vault token b balance is 1 here, likely due to rounding issues
    vaultTokenBAccountAfter.balance.lt(new BN(10)).should.be.true();
  });
}
