import "should";
import { TokenUtil } from "../../utils/token.util";
import {
  closePositionWrapper,
  depositWithNewUserWrapper,
  sleep,
  dripSPLTokenSwapWrapper,
  withdrawBWrapper,
  DripSPLTokenSwapWrapper,
  ClosePositionWrapper,
  WithdrawBWrapper,
  DeployWithNewUserWrapper,
} from "../../utils/setup.util";
import { AccountUtil } from "../../utils/account.util";
import { findError } from "../../utils/error.util";
import should from "should";
import { TokenSwapUtil } from "../../utils/tokenSwapUtil";
import { DeployVaultRes, DripUtil } from "../../utils/drip.util";
import { describe } from "mocha";

describe("#closePosition", testClosePosition);

export function testClosePosition() {
  let deployVaultRes: DeployVaultRes;

  let dripTrigger: DripSPLTokenSwapWrapper;
  let closePosition: ClosePositionWrapper;
  let withdrawB: WithdrawBWrapper;
  let depositWithNewUser: DeployWithNewUserWrapper;

  beforeEach(async () => {
    const deploySwap = await TokenSwapUtil.deployTokenSwap({});
    deployVaultRes = await DripUtil.deployVaultAndCreatePosition({
      tokenA: deploySwap.tokenA,
      tokenB: deploySwap.tokenB,
      tokenOwnerKeypair: deploySwap.tokenOwnerKeypair,
    });
    dripTrigger = dripSPLTokenSwapWrapper(
      deployVaultRes.botKeypair,
      deployVaultRes.botTokenAAcount,
      deployVaultRes.vault,
      deployVaultRes.vaultProtoConfig,
      deployVaultRes.vaultTokenAAccount,
      deployVaultRes.vaultTokenBAccount,
      deploySwap.tokenSwap.poolToken,
      deploySwap.tokenSwap.tokenAccountA,
      deploySwap.tokenSwap.tokenAccountB,
      deploySwap.tokenSwap.feeAccount,
      deploySwap.tokenSwap.authority,
      deploySwap.tokenSwap.tokenSwap
    );

    closePosition = closePositionWrapper(
      deployVaultRes.userKeypair,
      deployVaultRes.vault,
      deployVaultRes.vaultProtoConfig,
      deployVaultRes.userPositionAccount,
      deployVaultRes.vaultTokenAAccount,
      deployVaultRes.vaultTokenBAccount,
      deployVaultRes.vaultTreasuryTokenBAccount,
      deployVaultRes.userTokenAAccount,
      deployVaultRes.userTokenBAccount,
      deployVaultRes.userPositionNFTAccount,
      deployVaultRes.userPositionNFTMint.publicKey
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

  describe("when NFT position is delegated to the vault:", async () => {
    beforeEach(async () => {
      await deployVaultRes.userPositionNFTMint.approve(
        deployVaultRes.userPositionNFTAccount,
        deployVaultRes.vault,
        deployVaultRes.userKeypair.publicKey,
        [deployVaultRes.userKeypair],
        1
      );
    });

    it("should be able to close position before first drip", async () => {
      let [i, j, k] = [0, 0, 4];
      await closePosition(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[j],
        deployVaultRes.vaultPeriods[k]
      );
      const [
        userTokenAAccountAfter,
        userTokenBAccountAfter,
        vaultTreasuryTokenBAccountAfter,
        userPositionNFTAccountAfter,
        userPositionAccountAfter,
        vault_After,
        vaultPeriodUserExpiryAfter,
      ] = await Promise.all([
        TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenAAccount),
        TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
        TokenUtil.fetchTokenAccountInfo(
          deployVaultRes.vaultTreasuryTokenBAccount
        ),
        AccountUtil.provider.connection.getAccountInfo(
          deployVaultRes.userPositionNFTAccount
        ),
        AccountUtil.fetchPositionAccount(deployVaultRes.userPositionAccount),
        AccountUtil.fetchVaultAccount(deployVaultRes.vault),
        AccountUtil.fetchVaultPeriodAccount(deployVaultRes.vaultPeriods[k]),
      ]);

      userTokenAAccountAfter.balance.toString().should.equal("2000000000");
      userTokenBAccountAfter.balance.toString().should.equal("0");
      vaultTreasuryTokenBAccountAfter.balance.toString().should.equal("0");
      should(userPositionNFTAccountAfter).be.null();
      userPositionAccountAfter.isClosed.should.be.true();
      vaultPeriodUserExpiryAfter.dar.toString().should.equal("0");
      vault_After.dripAmount.toString().should.equal("0");
    });

    it("should be able to close position in the middle of the drip", async () => {
      for (let i = 0; i < 2; i++) {
        await dripTrigger(
          deployVaultRes.vaultPeriods[i],
          deployVaultRes.vaultPeriods[i + 1]
        );
        await sleep(1500);
      }

      let [i, j, k] = [0, 2, 4];
      await closePosition(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[j],
        deployVaultRes.vaultPeriods[k]
      );

      const [
        userTokenAAccountAfter,
        userTokenBAccountAfter,
        vaultTreasuryTokenBAccountAfter,
        userPositionNFTAccountAfter,
        userPositionAccountAfter,
        vault_After,
        vaultPeriodUserExpiryAfter,
      ] = await Promise.all([
        TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenAAccount),
        TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
        TokenUtil.fetchTokenAccountInfo(
          deployVaultRes.vaultTreasuryTokenBAccount
        ),
        AccountUtil.provider.connection.getAccountInfo(
          deployVaultRes.userPositionNFTAccount
        ),
        AccountUtil.fetchPositionAccount(deployVaultRes.userPositionAccount),
        AccountUtil.fetchVaultAccount(deployVaultRes.vault),
        AccountUtil.fetchVaultPeriodAccount(deployVaultRes.vaultPeriods[k]),
      ]);

      userTokenAAccountAfter.balance.toString().should.equal("1500000000");
      userTokenBAccountAfter.balance.toString().should.equal("496980729");
      vaultTreasuryTokenBAccountAfter.balance.toString().should.equal("995952");
      should(userPositionNFTAccountAfter).be.null();
      userPositionAccountAfter.isClosed.should.be.true();
      vaultPeriodUserExpiryAfter.dar.toString().should.equal("0");
      vault_After.dripAmount.toString().should.equal("0");
    });

    it("should be able to close position at the end of the drip", async () => {
      for (let i = 0; i < 4; i++) {
        await dripTrigger(
          deployVaultRes.vaultPeriods[i],
          deployVaultRes.vaultPeriods[i + 1]
        );
        await sleep(1500);
      }

      let [i, j, k] = [0, 4, 4];
      await closePosition(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[j],
        deployVaultRes.vaultPeriods[k]
      );

      const [
        userTokenAAccountAfter,
        userTokenBAccountAfter,
        vaultTreasuryTokenBAccountAfter,
        userPositionNFTAccountAfter,
        userPositionAccountAfter,
        vault_After,
        vaultPeriodUserExpiryAfter,
      ] = await Promise.all([
        TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenAAccount),
        TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
        TokenUtil.fetchTokenAccountInfo(
          deployVaultRes.vaultTreasuryTokenBAccount
        ),
        AccountUtil.provider.connection.getAccountInfo(
          deployVaultRes.userPositionNFTAccount
        ),
        AccountUtil.fetchPositionAccount(deployVaultRes.userPositionAccount),
        AccountUtil.fetchVaultAccount(deployVaultRes.vault),
        AccountUtil.fetchVaultPeriodAccount(deployVaultRes.vaultPeriods[k]),
      ]);

      userTokenAAccountAfter.balance.toString().should.equal("1000000000");
      userTokenBAccountAfter.balance.toString().should.equal("993911887");
      vaultTreasuryTokenBAccountAfter.balance
        .toString()
        .should.equal("1991806");
      should(userPositionNFTAccountAfter).be.null();
      userPositionAccountAfter.isClosed.should.be.true();
      vaultPeriodUserExpiryAfter.dar.toString().should.equal("250000000");
      vault_After.dripAmount.toString().should.equal("0");
    });

    it("should be able to close position after withdrawing", async () => {
      for (let i = 0; i < 4; i++) {
        await dripTrigger(
          deployVaultRes.vaultPeriods[i],
          deployVaultRes.vaultPeriods[i + 1]
        );
        await sleep(1500);
      }

      let [i, j, k] = [0, 4, 4];
      await withdrawB(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[j]
      );
      await closePosition(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[j],
        deployVaultRes.vaultPeriods[k]
      );

      const [
        userTokenAAccountAfter,
        userTokenBAccountAfter,
        vaultTreasuryTokenBAccountAfter,
        userPositionNFTAccountAfter,
        userPositionAccountAfter,
        vault_After,
        vaultPeriodUserExpiryAfter,
      ] = await Promise.all([
        TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenAAccount),
        TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
        TokenUtil.fetchTokenAccountInfo(
          deployVaultRes.vaultTreasuryTokenBAccount
        ),
        AccountUtil.provider.connection.getAccountInfo(
          deployVaultRes.userPositionNFTAccount
        ),
        AccountUtil.fetchPositionAccount(deployVaultRes.userPositionAccount),
        AccountUtil.fetchVaultAccount(deployVaultRes.vault),
        AccountUtil.fetchVaultPeriodAccount(deployVaultRes.vaultPeriods[k]),
      ]);

      userTokenAAccountAfter.balance.toString().should.equal("1000000000");
      userTokenBAccountAfter.balance.toString().should.equal("993911887");
      vaultTreasuryTokenBAccountAfter.balance
        .toString()
        .should.equal("1991806");
      should(userPositionNFTAccountAfter).be.null();
      userPositionAccountAfter.isClosed.should.be.true();
      vaultPeriodUserExpiryAfter.dar.toString().should.equal("250000000");
      vault_After.dripAmount.toString().should.equal("0");
    });

    it("should be able to close position past the end of the drip", async () => {
      await depositWithNewUser({
        mintAmount: 3,
        numberOfCycles: 5,
        newUserEndVaultPeriod: deployVaultRes.vaultPeriods[5],
      });
      for (let i = 0; i < 5; i++) {
        await dripTrigger(
          deployVaultRes.vaultPeriods[i],
          deployVaultRes.vaultPeriods[i + 1]
        );
        await sleep(1500);
      }

      let [i, j, k] = [0, 4, 4];
      await closePosition(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[j],
        deployVaultRes.vaultPeriods[k]
      );

      const [
        userTokenAAccountAfter,
        userTokenBAccountAfter,
        vaultTreasuryTokenBAccountAfter,
        userPositionNFTAccountAfter,
        userPositionAccountAfter,
      ] = await Promise.all([
        TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenAAccount),
        TokenUtil.fetchTokenAccountInfo(deployVaultRes.userTokenBAccount),
        TokenUtil.fetchTokenAccountInfo(
          deployVaultRes.vaultTreasuryTokenBAccount
        ),
        AccountUtil.provider.connection.getAccountInfo(
          deployVaultRes.userPositionNFTAccount
        ),
        AccountUtil.fetchPositionAccount(deployVaultRes.userPositionAccount),
      ]);

      userTokenAAccountAfter.balance.toString().should.equal("1000000000");
      userTokenBAccountAfter.balance.toString().should.equal("993674115");
      vaultTreasuryTokenBAccountAfter.balance
        .toString()
        .should.equal("1991330");
      should(userPositionNFTAccountAfter).be.null();
      userPositionAccountAfter.isClosed.should.be.true();
    });

    it("should fail if invalid vault periods are provided", async () => {
      await dripTrigger(
        deployVaultRes.vaultPeriods[0],
        deployVaultRes.vaultPeriods[1]
      );
      await sleep(1500);

      const testCases = [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 0],
        [1, 0, 0],
      ];
      for (const [i, j, k] of testCases) {
        await closePosition(
          deployVaultRes.vaultPeriods[i],
          deployVaultRes.vaultPeriods[j],
          deployVaultRes.vaultPeriods[k]
        ).should.be.rejectedWith(/0x177b/);
      }
      await dripTrigger(
        deployVaultRes.vaultPeriods[1],
        deployVaultRes.vaultPeriods[2]
      );
      for (const [i, j, k] of testCases) {
        await closePosition(
          deployVaultRes.vaultPeriods[i],
          deployVaultRes.vaultPeriods[j],
          deployVaultRes.vaultPeriods[k]
        ).should.be.rejectedWith(/0x177b/);
      }
    });

    it("should not be able to close position more than once", async () => {
      let [i, j, k] = [0, 0, 4];
      await closePosition(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[j],
        deployVaultRes.vaultPeriods[k]
      );
      const mint = TokenUtil.fetchMint(
        deployVaultRes.userPositionNFTMint.publicKey,
        deployVaultRes.userKeypair
      );
      const newUserPositionNFTAccount = await mint.createAssociatedTokenAccount(
        deployVaultRes.userKeypair.publicKey
      );
      newUserPositionNFTAccount
        .toString()
        .should.equal(deployVaultRes.userPositionNFTAccount.toString());

      await deployVaultRes.userPositionNFTMint.approve(
        newUserPositionNFTAccount,
        deployVaultRes.vault,
        deployVaultRes.userKeypair.publicKey,
        [deployVaultRes.userKeypair],
        1
      );
      await closePosition(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[j],
        deployVaultRes.vaultPeriods[k]
      ).should.be.rejectedWith(/0x177f/);
    });
  });

  it("should not be able to close position when NFT is not delegated to the vault", async () => {
    let [i, j, k] = [0, 0, 4];
    await closePosition(
      deployVaultRes.vaultPeriods[i],
      deployVaultRes.vaultPeriods[j],
      deployVaultRes.vaultPeriods[k]
    ).should.be.rejectedWith(/0x4/); // Owner does not match
  });
}
