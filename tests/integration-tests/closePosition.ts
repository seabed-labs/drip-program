import { SolUtils } from "../utils/SolUtils";
import { TokenUtil } from "../utils/Token.util";
import {
  amount,
  Denom,
  findAssociatedTokenAddress,
  generatePair,
  generatePairs,
  PDA,
} from "../utils/common.util";
import {
  closePositionWrapper,
  deploySwap,
  deployVault,
  deployVaultPeriod,
  deployVaultProtoConfig,
  depositToVault,
  depositWithNewUserWrapper,
  sleep,
  triggerDCAWrapper,
} from "../utils/setup.util";
import { Token, u64 } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import { AccountUtil } from "../utils/Account.util";

export function testClosePosition() {
  let tokenOwnerKeypair;
  let payerKeypair;

  let user: Keypair;
  let userTokenAAccount: PublicKey;
  let userTokenBAccount: PublicKey;

  let userPositionNFTMint;
  let userPositionAccount;
  let userPositionNFTAccount;
  let userPosition: Token;

  let tokenA: Token;
  let tokenB: Token;
  let swap: PublicKey;
  let vaultProtoConfig: PublicKey;
  let vaultPDA: PDA;
  let vaultPeriods: PDA[];
  let vaultTokenA_ATA: PublicKey;
  let vaultTokenB_ATA: PublicKey;

  let swapTokenMint: PublicKey;
  let swapTokenAAccount: PublicKey;
  let swapTokenBAccount: PublicKey;
  let swapFeeAccount: PublicKey;
  let swapAuthority: PublicKey;

  let trigerDCA;
  let closePosition;
  let depositWithNewUser;

  beforeEach(async () => {
    // https://discord.com/channels/889577356681945098/889702325231427584/910244405443715092
    // sleep to progress to the next block
    await sleep(500);

    user = generatePair();
    [tokenOwnerKeypair, payerKeypair] = generatePairs(2);
    await Promise.all([
      SolUtils.fundAccount(user.publicKey, 1000000000),
      SolUtils.fundAccount(payerKeypair.publicKey, 1000000000),
      SolUtils.fundAccount(tokenOwnerKeypair.publicKey, 1000000000),
    ]);

    tokenA = await TokenUtil.createMint(
      tokenOwnerKeypair.publicKey,
      null,
      6,
      payerKeypair
    );

    tokenB = await TokenUtil.createMint(
      tokenOwnerKeypair.publicKey,
      null,
      6,
      payerKeypair
    );

    [
      swap,
      swapTokenMint,
      swapTokenAAccount,
      swapTokenBAccount,
      swapFeeAccount,
      swapAuthority,
    ] = await deploySwap(
      tokenA,
      tokenOwnerKeypair,
      tokenB,
      tokenOwnerKeypair,
      payerKeypair
    );

    vaultProtoConfig = await deployVaultProtoConfig(1);

    vaultPDA = await deployVault(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultProtoConfig
    );

    [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
    ]);

    vaultPeriods = await Promise.all(
      [...Array(6).keys()].map((i) =>
        deployVaultPeriod(
          vaultProtoConfig,
          vaultPDA.publicKey,
          tokenA.publicKey,
          tokenB.publicKey,
          i
        )
      )
    );

    userTokenAAccount = await tokenA.createAssociatedTokenAccount(
      user.publicKey
    );
    const mintAmount = await TokenUtil.scaleAmount(
      amount(2, Denom.Thousand),
      tokenA
    );
    await tokenA.mintTo(userTokenAAccount, tokenOwnerKeypair, [], mintAmount);

    userTokenBAccount = await tokenB.createAssociatedTokenAccount(
      user.publicKey
    );

    const depositAmount = await TokenUtil.scaleAmount(
      amount(1, Denom.Thousand),
      tokenA
    );
    [userPositionNFTMint, userPositionAccount, userPositionNFTAccount] =
      await depositToVault(
        user,
        tokenA,
        depositAmount,
        new u64(4),
        vaultPDA.publicKey,
        vaultPeriods[4].publicKey,
        userTokenAAccount
      );

    userPosition = TokenUtil.fetchMint(userPositionNFTMint, user);

    trigerDCA = triggerDCAWrapper(
      user,
      vaultPDA.publicKey,
      vaultProtoConfig,
      vaultTokenA_ATA,
      vaultTokenB_ATA,
      tokenA.publicKey,
      tokenB.publicKey,
      swapTokenMint,
      swapTokenAAccount,
      swapTokenBAccount,
      swapFeeAccount,
      swapAuthority,
      swap
    );

    closePosition = closePositionWrapper(
      user,
      vaultPDA.publicKey,
      userPositionAccount,

      vaultTokenA_ATA,
      vaultTokenB_ATA,
      userTokenAAccount,
      userTokenBAccount,

      userPositionNFTAccount,

      userPositionNFTMint,
      tokenA.publicKey,
      tokenB.publicKey
    );

    depositWithNewUser = depositWithNewUserWrapper(
      vaultPDA.publicKey,
      tokenOwnerKeypair,
      tokenA
    );
  });

  it("should be able to close position before first first DCA", async () => {
    await userPosition.approve(
      userPositionNFTAccount,
      vaultPDA.publicKey,
      user.publicKey,
      [user],
      1
    );

    let [i, j, k] = [0, 0, 4];
    await closePosition(
      vaultPeriods[i].publicKey,
      vaultPeriods[j].publicKey,
      vaultPeriods[k].publicKey
    );
    const [
      userTokenAAccount_After,
      userTokenBAccount_After,
      userPositionNFTAccount_After,
      userPositionAccount_After,
      vault_After,
      vaultPeriodUserExpiry_After,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(userPositionNFTAccount),
      AccountUtil.fetchPositionAccount(userPositionAccount),
      AccountUtil.fetchVaultAccount(vaultPDA.publicKey),
      AccountUtil.fetchVaultPeriodAccount(vaultPeriods[k].publicKey),
    ]);

    userTokenAAccount_After.balance.toString().should.equal("2000000000");
    userTokenBAccount_After.balance.toString().should.equal("0");
    userPositionNFTAccount_After.balance.toString().should.equal("0");
    userPositionAccount_After.isClosed.should.be.true();
    vaultPeriodUserExpiry_After.dar.toString().should.equal("0");
    vault_After.dripAmount.toString().should.equal("0");
  });

  it("should be able to close position in the middle of the DCA", async () => {
    for (let i = 0; i < 2; i++) {
      await trigerDCA(vaultPeriods[i].publicKey, vaultPeriods[i + 1].publicKey);
      await sleep(1500);
    }
    await userPosition.approve(
      userPositionNFTAccount,
      vaultPDA.publicKey,
      user.publicKey,
      [user],
      1
    );

    let [i, j, k] = [0, 2, 4];
    await closePosition(
      vaultPeriods[i].publicKey,
      vaultPeriods[j].publicKey,
      vaultPeriods[k].publicKey
    );

    const [
      userTokenAAccount_After,
      userTokenBAccount_After,
      userPositionNFTAccount_After,
      userPositionAccount_After,
      vault_After,
      vaultPeriodUserExpiry_After,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(userPositionNFTAccount),
      AccountUtil.fetchPositionAccount(userPositionAccount),
      AccountUtil.fetchVaultAccount(vaultPDA.publicKey),
      AccountUtil.fetchVaultPeriodAccount(vaultPeriods[k].publicKey),
    ]);

    userTokenAAccount_After.balance.toString().should.equal("1500000000");
    userTokenBAccount_After.balance.toString().should.equal("498251432");
    userPositionNFTAccount_After.balance.toString().should.equal("0");
    userPositionAccount_After.isClosed.should.be.true();
    vaultPeriodUserExpiry_After.dar.toString().should.equal("0");
    vault_After.dripAmount.toString().should.equal("0");
  });

  it("should be able to close position at the end of the DCA", async () => {
    for (let i = 0; i < 4; i++) {
      await trigerDCA(vaultPeriods[i].publicKey, vaultPeriods[i + 1].publicKey);
      await sleep(1500);
    }
    await userPosition.approve(
      userPositionNFTAccount,
      vaultPDA.publicKey,
      user.publicKey,
      [user],
      1
    );

    let [i, j, k] = [0, 4, 4];
    await closePosition(
      vaultPeriods[i].publicKey,
      vaultPeriods[j].publicKey,
      vaultPeriods[k].publicKey
    );

    const [
      userTokenAAccount_After,
      userTokenBAccount_After,
      userPositionNFTAccount_After,
      userPositionAccount_After,
      vault_After,
      vaultPeriodUserExpiry_After,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(userPositionNFTAccount),
      AccountUtil.fetchPositionAccount(userPositionAccount),
      AccountUtil.fetchVaultAccount(vaultPDA.publicKey),
      AccountUtil.fetchVaultPeriodAccount(vaultPeriods[k].publicKey),
    ]);

    userTokenAAccount_After.balance.toString().should.equal("1000000000");
    userTokenBAccount_After.balance.toString().should.equal("996005859");
    userPositionNFTAccount_After.balance.toString().should.equal("0");
    userPositionAccount_After.isClosed.should.be.true();
    vaultPeriodUserExpiry_After.dar.toString().should.equal("250000000");
    vault_After.dripAmount.toString().should.equal("0");
  });

  it("should be able to close position past the end of the DCA", async () => {
    await depositWithNewUser({
      mintAmount: 3,
      dcaCycles: 5,
      newUserEndVaultPeriod: vaultPeriods[5].publicKey,
    });
    for (let i = 0; i < 5; i++) {
      await trigerDCA(vaultPeriods[i].publicKey, vaultPeriods[i + 1].publicKey);
      await sleep(1500);
    }
    await userPosition.approve(
      userPositionNFTAccount,
      vaultPDA.publicKey,
      user.publicKey,
      [user],
      1
    );

    let [i, j, k] = [0, 4, 4];
    await closePosition(
      vaultPeriods[i].publicKey,
      vaultPeriods[j].publicKey,
      vaultPeriods[k].publicKey
    );

    const [
      userTokenAAccount_After,
      userTokenBAccount_After,
      userPositionNFTAccount_After,
      userPositionAccount_After,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(userPositionNFTAccount),
      AccountUtil.fetchPositionAccount(userPositionAccount),
    ]);

    userTokenAAccount_After.balance.toString().should.equal("1000000000");
    userTokenBAccount_After.balance.toString().should.equal("993628003");
    userPositionNFTAccount_After.balance.toString().should.equal("0");
    userPositionAccount_After.isClosed.should.be.true();
  });

  it("should fail if invalid vault periods are provided", async () => {
    await trigerDCA(vaultPeriods[0].publicKey, vaultPeriods[1].publicKey);
    await sleep(1500);
    await userPosition.approve(
      userPositionNFTAccount,
      vaultPDA.publicKey,
      user.publicKey,
      [user],
      1
    );
    const testCases = [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 0],
    ];
    for (const [i, j, k] of testCases) {
      await closePosition(
        vaultPeriods[i].publicKey,
        vaultPeriods[j].publicKey,
        vaultPeriods[k].publicKey
      ).should.be.rejectedWith(new RegExp(".*A raw constraint was violated"));
    }
    await trigerDCA(vaultPeriods[1].publicKey, vaultPeriods[2].publicKey);
    for (const [i, j, k] of testCases) {
      await closePosition(
        vaultPeriods[i].publicKey,
        vaultPeriods[j].publicKey,
        vaultPeriods[k].publicKey
      ).should.be.rejectedWith(new RegExp(".*A raw constraint was violated"));
    }
  });

  it("should not be able to close position more than once", async () => {
    let [i, j, k] = [0, 0, 4];
    await userPosition.approve(
      userPositionNFTAccount,
      vaultPDA.publicKey,
      user.publicKey,
      [user],
      1
    );
    await closePosition(
      vaultPeriods[i].publicKey,
      vaultPeriods[j].publicKey,
      vaultPeriods[k].publicKey
    );
    await userPosition.approve(
      userPositionNFTAccount,
      vaultPDA.publicKey,
      user.publicKey,
      [user],
      1
    );
    await closePosition(
      vaultPeriods[i].publicKey,
      vaultPeriods[j].publicKey,
      vaultPeriods[k].publicKey
    ).should.be.rejectedWith(new RegExp(".*A raw constraint was violated"));
  });
}
