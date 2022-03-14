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
  deploySwap,
  deployVault,
  deployVaultPeriod,
  deployVaultProtoConfig,
  depositToVault,
  depositWithNewUserWrapper,
  sleep,
  triggerDCAWrapper,
  withdrawBWrapper,
} from "../utils/setup.util";
import { Token, u64 } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import { BN } from "@project-serum/anchor";
import { AccountUtil } from "../utils/Account.util";

export function testWithdrawB() {
  let tokenOwnerKeypair;
  let payerKeypair;

  let user: Keypair;
  let userTokenAAccount: PublicKey;
  let userTokenBAccount: PublicKey;

  let userPositionNFTMint;
  let userPositionAccount;
  let userPostionNFTAccount;

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
  let withdrawB;
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
    [userPositionNFTMint, userPositionAccount, userPostionNFTAccount] =
      await depositToVault(
        user,
        tokenA,
        depositAmount,
        new u64(4),
        vaultPDA.publicKey,
        vaultPeriods[4].publicKey,
        userTokenAAccount
      );

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

    withdrawB = withdrawBWrapper(
      user,
      vaultPDA.publicKey,
      userPositionAccount,
      userPostionNFTAccount,
      userPositionNFTMint,
      vaultTokenA_ATA,
      vaultTokenB_ATA,
      tokenB.publicKey,
      userTokenBAccount
    );

    depositWithNewUser = depositWithNewUserWrapper(
      vaultPDA.publicKey,
      tokenOwnerKeypair,
      tokenA
    );
  });

  it("should be able to withdraw in the middle of the DCA", async () => {
    const [userTokenBAccount_Before] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
    ]);

    for (let i = 0; i < 2; i++) {
      await trigerDCA(vaultPeriods[i].publicKey, vaultPeriods[i + 1].publicKey);
      await sleep(1500);
    }

    let [i, j] = [0, 2];
    await withdrawB(vaultPeriods[i].publicKey, vaultPeriods[j].publicKey);

    const [userTokenBAccount_After, vaultTokenB_ATA_After] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTokenB_ATA),
    ]);

    userTokenBAccount_After.balance
      .gt(userTokenBAccount_Before.balance)
      .should.be.true();
    userTokenBAccount_After.balance.toString().should.equal("498251432");
    // The vault token b balance is 1 here, likely due to rounding issues
    vaultTokenB_ATA_After.balance.lt(new BN(10)).should.be.true();
  });

  it("should be able to withdraw at the end of the DCA", async () => {
    const [userTokenBAccount_Before] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
    ]);

    for (let i = 0; i < 4; i++) {
      await trigerDCA(vaultPeriods[i].publicKey, vaultPeriods[i + 1].publicKey);
      await sleep(1500);
    }

    let [i, j] = [0, 4];
    await withdrawB(vaultPeriods[i].publicKey, vaultPeriods[j].publicKey);

    const [userTokenBAccount_After, vaultTokenB_ATA_After] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTokenB_ATA),
    ]);

    userTokenBAccount_After.balance
      .gt(userTokenBAccount_Before.balance)
      .should.be.true();
    userTokenBAccount_After.balance.toString().should.equal("996005859");
    // The vault token b balance is 1 here, likely due to rounding issues
    vaultTokenB_ATA_After.balance.lt(new BN(10)).should.be.true();
  });

  it("should be able to withdraw in the middle of the DCA and at the end", async () => {
    for (let i = 0; i < 2; i++) {
      await trigerDCA(vaultPeriods[i].publicKey, vaultPeriods[i + 1].publicKey);
      await sleep(1500);
    }
    await withdrawB(vaultPeriods[0].publicKey, vaultPeriods[2].publicKey);
    let [userTokenBAccount_After] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
    ]);
    userTokenBAccount_After.balance.toString().should.equal("498251432");
    for (let i = 2; i < 4; i++) {
      await trigerDCA(vaultPeriods[i].publicKey, vaultPeriods[i + 1].publicKey);
      await sleep(1500);
    }
    await withdrawB(vaultPeriods[0].publicKey, vaultPeriods[4].publicKey);
    [userTokenBAccount_After] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
    ]);
    userTokenBAccount_After.balance.toString().should.equal("996005859");
  });

  it("should not be able to withdraw twice in the same period", async () => {
    await depositWithNewUser({
      mintAmount: 3,
      dcaCycles: 2,
      newUserEndVaultPeriod: vaultPeriods[2].publicKey,
    });
    for (let i = 0; i < 2; i++) {
      await trigerDCA(vaultPeriods[i].publicKey, vaultPeriods[i + 1].publicKey);
      await sleep(1500);
    }
    let [i, j] = [0, 2];
    const [userTokenBAccount_Before, userPositionAccount_Before] =
      await Promise.all([
        TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
        AccountUtil.fetchPositionAccount(userPositionAccount),
      ]);
    userTokenBAccount_Before.balance.toString().should.equal("0");
    userPositionAccount_Before.withdrawnTokenBAmount
      .toString()
      .should.equal("0");
    await withdrawB(vaultPeriods[i].publicKey, vaultPeriods[j].publicKey);
    let [userTokenBAccount_After, userPositionAccount_After] =
      await Promise.all([
        TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
        AccountUtil.fetchPositionAccount(userPositionAccount),
      ]);
    userTokenBAccount_After.balance.toString().should.equal("496765235");
    userPositionAccount_After.withdrawnTokenBAmount
      .toString()
      .should.equal("496765235");

    await withdrawB(
      vaultPeriods[i].publicKey,
      vaultPeriods[j].publicKey
    ).should.be.rejectedWith(new RegExp("Withdrawable amount is zero"));
  });

  it("should not be able to withdraw when withdrawable amount is 0", async () => {
    let [i, j] = [0, 0];
    await withdrawB(
      vaultPeriods[i].publicKey,
      vaultPeriods[j].publicKey
    ).should.rejectedWith(new RegExp(".*Withdrawable amount is zero"));
  });
}
