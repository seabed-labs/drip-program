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
import { BN } from "@coral-xyz/anchor";
import { AccountUtil } from "../../utils/account.util";
import { findError } from "../../utils/error.util";
import { initLog } from "../../utils/log.util";
import { TestUtil } from "../../utils/config.util";
import { Mint } from "@solana/spl-token";

describe("#withdrawBWithReferrer", testWithdrawB);

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
  let vaultPeriods: PDA[];
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

  let referrer: PublicKey;

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
      5,
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

    const referrerWallet = generatePair().publicKey;

    referrer = await TokenUtil.getOrCreateAssociatedTokenAccount(
      tokenB,
      referrerWallet,
      payerKeypair,
    );

    userTokenAAccount = await TokenUtil.getOrCreateAssociatedTokenAccount(
      tokenA,
      user.publicKey,
      payerKeypair,
    );
    const mintAmount = await TokenUtil.scaleAmount(
      amount(2, Denom.Thousand),
      tokenA,
    );
    await TokenUtil.mintTo({
      payer: payerKeypair,
      amount: mintAmount,
      token: tokenA,
      mintAuthority: tokenOwnerKeypair,
      recipient: userTokenAAccount,
    });

    botTokenAAccount = await TokenUtil.getOrCreateAssociatedTokenAccount(
      tokenA,
      bot.publicKey,
      payerKeypair,
    );

    userTokenBAccount = await TokenUtil.getOrCreateAssociatedTokenAccount(
      tokenB,
      user.publicKey,
      payerKeypair,
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
        referrer,
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
      referrer,
    );

    depositWithNewUser = depositWithNewUserWrapper(
      vaultPDA.publicKey,
      tokenOwnerKeypair,
      tokenA,
      referrer,
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
      referrerTokenBAccountAfter,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTreasuryTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(referrer),
    ]);

    userTokenBAccountAfter.amount.toString().should.equal("497504432");
    vaultTreasuryTokenBAccountAfter.amount.toString().should.equal("249001");
    referrerTokenBAccountAfter.amount.toString().should.equal("249001");
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
      referrerTokenBAccountAfter,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTreasuryTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(referrer),
    ]);

    userTokenBAccountAfter.amount.toString().should.equal("994512849");
    vaultTreasuryTokenBAccountAfter.amount.toString().should.equal("497754");
    referrerTokenBAccountAfter.amount.toString().should.equal("497754");
    // The vault token b balance is 1 here, likely due to rounding issues
    (vaultTokenBAccountAfter.amount < new BN(10)).should.be.true();
  });
}
