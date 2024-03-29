import "should";
import { SolUtil } from "../../utils/sol.util";
import { TokenUtil } from "../../utils/token.util";
import {
  amount,
  Denom,
  findAssociatedTokenAddress,
  generatePair,
  generatePairs,
  PDA,
} from "../../utils/common.util";
import {
  deploySPLTokenSwap,
  deployVault,
  deployVaultPeriod,
  deployVaultProtoConfig,
  depositToVault,
  depositWithNewUserWrapper,
  sleep,
  dripSPLTokenSwapWrapper,
  withdrawBWrapper,
} from "../../utils/setup.util";
import { Keypair, PublicKey } from "@solana/web3.js";
import { AccountUtil } from "../../utils/account.util";
import { findError } from "../../utils/error.util";
import { initLog } from "../../utils/log.util";
import { TestUtil } from "../../utils/config.util";
import { Mint } from "@solana/spl-token";

describe("#withdrawB", testWithdrawB);

export function testWithdrawB() {
  initLog();

  let tokenOwnerKeypair: Keypair;
  let payerKeypair: Keypair;

  let user: Keypair;
  let userTokenAAccount: PublicKey;
  let userTokenBAccount: PublicKey;

  let bot: Keypair;
  let botTokenAAccount: PublicKey;

  let userPositionNFTMint: PublicKey;
  let userPositionAccount: PublicKey;
  let userPostionNFTAccount: PublicKey;

  let tokenA: Mint;
  let tokenB: Mint;
  let swap: PublicKey;
  let vaultProtoConfig: PublicKey;
  let vaultPDA: PDA;
  let vaultPeriods: PDA[] = [];
  let vaultTokenAAccount: PublicKey;
  let vaultTokenBAccount: PublicKey;
  let vaultTreasuryTokenBAccount: PublicKey;

  let swapTokenMint: PublicKey;
  let swapTokenAAccount: PublicKey;
  let swapTokenBAccount: PublicKey;
  let swapFeeAccount: PublicKey;
  let swapAuthority: PublicKey;

  let dripTrigger;
  let withdrawB;
  let depositWithNewUser;

  beforeEach(async () => {
    // https://discord.com/channels/889577356681945098/889702325231427584/910244405443715092
    // sleep to progress to the next block
    await sleep(500);

    user = generatePair();
    bot = generatePair();
    [tokenOwnerKeypair, payerKeypair] = generatePairs(2);
    await Promise.all([
      SolUtil.fundAccount(user.publicKey, SolUtil.solToLamports(0.1)),
      SolUtil.fundAccount(bot.publicKey, SolUtil.solToLamports(0.1)),
      SolUtil.fundAccount(payerKeypair.publicKey, SolUtil.solToLamports(0.1)),
      SolUtil.fundAccount(
        tokenOwnerKeypair.publicKey,
        SolUtil.solToLamports(0.1),
      ),
    ]);

    tokenA = await TokenUtil.createMint(
      tokenOwnerKeypair.publicKey,
      null,
      6,
      payerKeypair,
    );

    tokenB = await TokenUtil.createMint(
      tokenOwnerKeypair.publicKey,
      null,
      6,
      payerKeypair,
    );

    [
      swap,
      swapTokenMint,
      swapTokenAAccount,
      swapTokenBAccount,
      swapFeeAccount,
      swapAuthority,
    ] = await deploySPLTokenSwap(
      tokenA,
      tokenOwnerKeypair,
      tokenB,
      tokenOwnerKeypair,
      payerKeypair,
    );

    vaultProtoConfig = await deployVaultProtoConfig(
      1,
      5,
      5,
      0,
      TestUtil.provider.wallet.publicKey,
    );

    vaultTreasuryTokenBAccount = await TokenUtil.createTokenAccount(
      tokenB,
      payerKeypair.publicKey,
      payerKeypair,
    );

    vaultPDA = await deployVault(
      tokenA.address,
      tokenB.address,
      vaultTreasuryTokenBAccount,
      vaultProtoConfig,
    );

    [vaultTokenAAccount, vaultTokenBAccount] = await Promise.all([
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.address),
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.address),
    ]);

    vaultPeriods = await Promise.all(
      [...Array(6).keys()].map((i) =>
        deployVaultPeriod(
          vaultProtoConfig,
          vaultPDA.publicKey,
          tokenA.address,
          tokenB.address,
          i,
        ),
      ),
    );
    userTokenAAccount = await TokenUtil.getOrCreateAssociatedTokenAccount(
      tokenA,
      user.publicKey,
      user,
    );
    const mintAmount = await TokenUtil.scaleAmount(
      amount(2, Denom.Thousand),
      tokenA,
    );
    await TokenUtil.mintTo({
      payer: user,
      token: tokenA,
      mintAuthority: tokenOwnerKeypair,
      recipient: userTokenAAccount,
      amount: mintAmount,
    });

    botTokenAAccount = await TokenUtil.getOrCreateAssociatedTokenAccount(
      tokenA,
      bot.publicKey,
      bot,
    );

    userTokenBAccount = await TokenUtil.getOrCreateAssociatedTokenAccount(
      tokenB,
      user.publicKey,
      user,
    );

    const depositAmount = await TokenUtil.scaleAmount(
      amount(1, Denom.Thousand),
      tokenA,
    );
    [userPositionNFTMint, userPositionAccount, userPostionNFTAccount] =
      await depositToVault(
        user,
        tokenA,
        depositAmount,
        BigInt(4),
        vaultPDA.publicKey,
        vaultPeriods[4].publicKey,
        userTokenAAccount,
        vaultTreasuryTokenBAccount,
      );

    dripTrigger = dripSPLTokenSwapWrapper(
      user,
      botTokenAAccount,
      vaultPDA.publicKey,
      vaultProtoConfig,
      vaultTokenAAccount,
      vaultTokenBAccount,
      swapTokenMint,
      swapTokenAAccount,
      swapTokenBAccount,
      swapFeeAccount,
      swapAuthority,
      swap,
    );

    withdrawB = withdrawBWrapper(
      user,
      vaultPDA.publicKey,
      vaultProtoConfig,
      userPositionAccount,
      userPostionNFTAccount,
      vaultTokenBAccount,
      vaultTreasuryTokenBAccount,
      userTokenBAccount,
    );

    depositWithNewUser = depositWithNewUserWrapper(
      vaultPDA.publicKey,
      tokenOwnerKeypair,
      tokenA,
      vaultTreasuryTokenBAccount,
    );
  });

  it("should be able to withdraw in the middle of the drip", async () => {
    const [userTokenBAccountBefore] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
    ]);

    for (let i = 0; i < 2; i++) {
      await dripTrigger(
        vaultPeriods[i].publicKey,
        vaultPeriods[i + 1].publicKey,
      );
      await sleep(1500);
    }

    let [i, j] = [0, 2];
    await withdrawB(vaultPeriods[i].publicKey, vaultPeriods[j].publicKey);

    const [
      userTokenBAccountAfter,
      vaultTokenBAccountAfter,
      vaultTreasuryTokenBAccountAfter,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTreasuryTokenBAccount),
    ]);

    userTokenBAccountAfter.amount.toString().should.equal("497753433");
    vaultTreasuryTokenBAccountAfter.amount.toString().should.equal("249001");
    // The vault token b balance is 1 here, likely due to rounding issues
    (vaultTokenBAccountAfter.amount < BigInt(10)).should.be.true();
  });

  it("should be able to withdraw at the end of the drip", async () => {
    const [userTokenBAccountBefore] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
    ]);

    for (let i = 0; i < 4; i++) {
      await dripTrigger(
        vaultPeriods[i].publicKey,
        vaultPeriods[i + 1].publicKey,
      );
      await sleep(1500);
    }

    let [i, j] = [0, 4];
    await withdrawB(vaultPeriods[i].publicKey, vaultPeriods[j].publicKey);

    const [
      userTokenBAccountAfter,
      vaultTokenBAccountAfter,
      vaultTreasuryTokenBAccountAfter,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTreasuryTokenBAccount),
    ]);

    userTokenBAccountAfter.amount.toString().should.equal("995010603");
    vaultTreasuryTokenBAccountAfter.amount.toString().should.equal("497754");
    // The vault token b balance is 1 here, likely due to rounding issues
    (vaultTokenBAccountAfter.amount < BigInt(10)).should.be.true();
  });

  it("should be able to withdraw in the middle of the drip and at the end", async () => {
    for (let i = 0; i < 2; i++) {
      await dripTrigger(
        vaultPeriods[i].publicKey,
        vaultPeriods[i + 1].publicKey,
      );
      await sleep(1500);
    }
    await withdrawB(vaultPeriods[0].publicKey, vaultPeriods[2].publicKey);
    let [userTokenBAccountAfter, vaultTreasuryTokenBAccountAfter] =
      await Promise.all([
        TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
        TokenUtil.fetchTokenAccountInfo(vaultTreasuryTokenBAccount),
      ]);
    userTokenBAccountAfter.amount.toString().should.equal("497753433");
    vaultTreasuryTokenBAccountAfter.amount.toString().should.equal("249001");
    for (let i = 2; i < 4; i++) {
      await dripTrigger(
        vaultPeriods[i].publicKey,
        vaultPeriods[i + 1].publicKey,
      );
      await sleep(1500);
    }
    await withdrawB(vaultPeriods[0].publicKey, vaultPeriods[4].publicKey);
    [userTokenBAccountAfter, vaultTreasuryTokenBAccountAfter] =
      await Promise.all([
        TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
        TokenUtil.fetchTokenAccountInfo(vaultTreasuryTokenBAccount),
      ]);
    // Diff of 1 from previous test due to rounding issues since we always round down
    userTokenBAccountAfter.amount.toString().should.equal("995010604");
    vaultTreasuryTokenBAccountAfter.amount.toString().should.equal("497753");
  });

  it("should not be able to withdraw twice in the same period", async () => {
    await depositWithNewUser({
      mintAmount: 3,
      numberOfCycles: 2,
      newUserEndVaultPeriod: vaultPeriods[2].publicKey,
    });
    for (let i = 0; i < 2; i++) {
      await dripTrigger(
        vaultPeriods[i].publicKey,
        vaultPeriods[i + 1].publicKey,
      );
      await sleep(1500);
    }
    let [i, j] = [0, 2];
    const [userTokenBAccountBefore, userPositionAccountBefore] =
      await Promise.all([
        TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
        AccountUtil.fetchPositionAccount(userPositionAccount),
      ]);
    userTokenBAccountBefore.amount.toString().should.equal("0");
    userPositionAccountBefore.withdrawnTokenBAmount
      .toString()
      .should.equal("0");
    await withdrawB(vaultPeriods[i].publicKey, vaultPeriods[j].publicKey);
    let [userTokenBAccountAfter, userPositionAccountAfter] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
      AccountUtil.fetchPositionAccount(userPositionAccount),
    ]);
    userTokenBAccountAfter.amount.toString().should.equal("496269459");
    userPositionAccountAfter.withdrawnTokenBAmount
      .toString()
      .should.equal("496517717");
    try {
      await withdrawB(vaultPeriods[i].publicKey, vaultPeriods[j].publicKey);
    } catch (e) {
      findError(
        e,
        new RegExp("Withdrawable amount is zero"),
      ).should.not.be.undefined();
    }
  });

  it("should not be able to withdraw when withdrawable amount is 0", async () => {
    let [i, j] = [0, 0];
    try {
      await withdrawB(vaultPeriods[i].publicKey, vaultPeriods[j].publicKey);
    } catch (e) {
      findError(
        e,
        new RegExp(".*Withdrawable amount is zero"),
      ).should.not.be.undefined();
    }
  });
}
