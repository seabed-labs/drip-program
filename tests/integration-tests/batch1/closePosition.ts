import "should";
import { SolUtil } from "../../utils/sol.util";
import { TokenUtil } from "../../utils/token.util";
import {
  amount,
  Denom,
  findAssociatedTokenAddress,
  generatePairs,
  PDA,
} from "../../utils/common.util";
import {
  closePositionWrapper,
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
import { Mint } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import { AccountUtil } from "../../utils/account.util";
import { findError } from "../../utils/error.util";
import { initLog } from "../../utils/log.util";
import { TestUtil } from "../../utils/config.util";
import should from "should";

describe("#closePosition", testClosePosition);

export function testClosePosition() {
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
  let userPositionNFTAccount: PublicKey;

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
  let closePosition;
  let withdraw;
  let depositWithNewUser;

  beforeEach(async () => {
    // https://discord.com/channels/889577356681945098/889702325231427584/910244405443715092
    // sleep to progress to the next block
    await sleep(500);
    [user, bot, tokenOwnerKeypair, payerKeypair] = generatePairs(4);
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
    [userPositionNFTMint, userPositionAccount, userPositionNFTAccount] =
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

    const userPosition = await TokenUtil.fetchMint(userPositionNFTMint);

    dripTrigger = dripSPLTokenSwapWrapper(
      bot,
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

    closePosition = closePositionWrapper(
      user,
      vaultPDA.publicKey,
      vaultProtoConfig,
      userPositionAccount,
      vaultTokenAAccount,
      vaultTokenBAccount,
      vaultTreasuryTokenBAccount,
      userTokenAAccount,
      userTokenBAccount,
      userPositionNFTAccount,
      userPositionNFTMint,
    );

    withdraw = withdrawBWrapper(
      user,
      vaultPDA.publicKey,
      vaultProtoConfig,
      userPositionAccount,
      userPositionNFTAccount,
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

  it("should be able to close position before first drip", async () => {
    let [i, j, k] = [0, 0, 4];
    await closePosition(
      vaultPeriods[i].publicKey,
      vaultPeriods[j].publicKey,
      vaultPeriods[k].publicKey,
    );
    const [
      userTokenAAccountAfter,
      userTokenBAccountAfter,
      vaultTreasuryTokenBAccountAfter,
      userPositionNFTAccountAfter,
      vault_After,
      vaultPeriodUserExpiryAfter,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTreasuryTokenBAccount),
      AccountUtil.provider.connection.getAccountInfo(userPositionNFTAccount),
      AccountUtil.fetchVaultAccount(vaultPDA.publicKey),
      AccountUtil.fetchVaultPeriodAccount(vaultPeriods[k].publicKey),
    ]);

    userTokenAAccountAfter.amount.toString().should.equal("2000000000");
    userTokenBAccountAfter.amount.toString().should.equal("0");
    vaultTreasuryTokenBAccountAfter.amount.toString().should.equal("0");
    await AccountUtil.fetchPositionAccount(
      userPositionAccount,
    ).should.be.rejectedWith(/Account does not exist or has no data/);
    should(userPositionNFTAccountAfter).be.null();
    vaultPeriodUserExpiryAfter.dar.toString().should.equal("0");
    vault_After.dripAmount.toString().should.equal("0");
  });

  it("should be able to close position in the middle of the drip", async () => {
    for (let i = 0; i < 2; i++) {
      await dripTrigger(
        vaultPeriods[i].publicKey,
        vaultPeriods[i + 1].publicKey,
      );
      await sleep(1500);
    }

    let [i, j, k] = [0, 2, 4];
    await closePosition(
      vaultPeriods[i].publicKey,
      vaultPeriods[j].publicKey,
      vaultPeriods[k].publicKey,
    );

    const [
      userTokenAAccountAfter,
      userTokenBAccountAfter,
      vaultTreasuryTokenBAccountAfter,
      userPositionNFTAccountAfter,
      vault_After,
      vaultPeriodUserExpiryAfter,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTreasuryTokenBAccount),
      AccountUtil.provider.connection.getAccountInfo(userPositionNFTAccount),
      AccountUtil.fetchVaultAccount(vaultPDA.publicKey),
      AccountUtil.fetchVaultPeriodAccount(vaultPeriods[k].publicKey),
    ]);

    userTokenAAccountAfter.amount.toString().should.equal("1500000000");
    userTokenBAccountAfter.amount.toString().should.equal("497753433");
    vaultTreasuryTokenBAccountAfter.amount.toString().should.equal("249001");
    should(userPositionNFTAccountAfter).be.null();
    await AccountUtil.fetchPositionAccount(
      userPositionAccount,
    ).should.be.rejectedWith(/Account does not exist or has no data/);
    vaultPeriodUserExpiryAfter.dar.toString().should.equal("0");
    vault_After.dripAmount.toString().should.equal("0");
  });

  it("should be able to close position at the end of the drip", async () => {
    for (let i = 0; i < 4; i++) {
      await dripTrigger(
        vaultPeriods[i].publicKey,
        vaultPeriods[i + 1].publicKey,
      );
      await sleep(1500);
    }

    let [i, j, k] = [0, 4, 4];
    await closePosition(
      vaultPeriods[i].publicKey,
      vaultPeriods[j].publicKey,
      vaultPeriods[k].publicKey,
    );

    const [
      userTokenAAccountAfter,
      userTokenBAccountAfter,
      vaultTreasuryTokenBAccountAfter,
      userPositionNFTAccountAfter,
      vault_After,
      vaultPeriodUserExpiryAfter,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTreasuryTokenBAccount),
      AccountUtil.provider.connection.getAccountInfo(userPositionNFTAccount),
      AccountUtil.fetchVaultAccount(vaultPDA.publicKey),
      AccountUtil.fetchVaultPeriodAccount(vaultPeriods[k].publicKey),
    ]);

    userTokenAAccountAfter.amount.toString().should.equal("1000000000");
    userTokenBAccountAfter.amount.toString().should.equal("995010603");
    vaultTreasuryTokenBAccountAfter.amount.toString().should.equal("497754");
    should(userPositionNFTAccountAfter).be.null();
    await AccountUtil.fetchPositionAccount(
      userPositionAccount,
    ).should.be.rejectedWith(/Account does not exist or has no data/);
    vaultPeriodUserExpiryAfter.dar.toString().should.equal("250000000");
    vault_After.dripAmount.toString().should.equal("0");
  });

  it("should be able to close position after withdrawing", async () => {
    for (let i = 0; i < 4; i++) {
      await dripTrigger(
        vaultPeriods[i].publicKey,
        vaultPeriods[i + 1].publicKey,
      );
      await sleep(1500);
    }

    let [i, j, k] = [0, 4, 4];
    await withdraw(vaultPeriods[i].publicKey, vaultPeriods[j].publicKey);
    await closePosition(
      vaultPeriods[i].publicKey,
      vaultPeriods[j].publicKey,
      vaultPeriods[k].publicKey,
    );

    const [
      userTokenAAccountAfter,
      userTokenBAccountAfter,
      vaultTreasuryTokenBAccountAfter,
      userPositionNFTAccountAfter,
      vault_After,
      vaultPeriodUserExpiryAfter,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTreasuryTokenBAccount),
      AccountUtil.provider.connection.getAccountInfo(userPositionNFTAccount),
      AccountUtil.fetchVaultAccount(vaultPDA.publicKey),
      AccountUtil.fetchVaultPeriodAccount(vaultPeriods[k].publicKey),
    ]);

    userTokenAAccountAfter.amount.toString().should.equal("1000000000");
    userTokenBAccountAfter.amount.toString().should.equal("995010603");
    vaultTreasuryTokenBAccountAfter.amount.toString().should.equal("497754");
    should(userPositionNFTAccountAfter).be.null();
    await AccountUtil.fetchPositionAccount(
      userPositionAccount,
    ).should.be.rejectedWith(/Account does not exist or has no data/);
    vaultPeriodUserExpiryAfter.dar.toString().should.equal("250000000");
    vault_After.dripAmount.toString().should.equal("0");
  });

  it("should be able to close position past the end of the drip", async () => {
    await depositWithNewUser({
      mintAmount: 3,
      numberOfCycles: 5,
      newUserEndVaultPeriod: vaultPeriods[5].publicKey,
    });
    for (let i = 0; i < 5; i++) {
      await dripTrigger(
        vaultPeriods[i].publicKey,
        vaultPeriods[i + 1].publicKey,
      );
      await sleep(1500);
    }

    let [i, j, k] = [0, 4, 4];
    await closePosition(
      vaultPeriods[i].publicKey,
      vaultPeriods[j].publicKey,
      vaultPeriods[k].publicKey,
    );

    const [
      userTokenAAccountAfter,
      userTokenBAccountAfter,
      vaultTreasuryTokenBAccountAfter,
      userPositionNFTAccountAfter,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(userTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(userTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTreasuryTokenBAccount),
      AccountUtil.provider.connection.getAccountInfo(userPositionNFTAccount),
    ]);

    userTokenAAccountAfter.amount.toString().should.equal("1000000000");
    userTokenBAccountAfter.amount.toString().should.equal("992636304");
    vaultTreasuryTokenBAccountAfter.amount.toString().should.equal("496566");
    should(userPositionNFTAccountAfter).be.null();
    await AccountUtil.fetchPositionAccount(
      userPositionAccount,
    ).should.be.rejectedWith(/Account does not exist or has no data/);
  });

  it("should fail if invalid vault periods are provided", async () => {
    await dripTrigger(vaultPeriods[0].publicKey, vaultPeriods[1].publicKey);
    await sleep(1500);

    const testCases = [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 0],
    ];
    for (const [i, j, k] of testCases) {
      try {
        await closePosition(
          vaultPeriods[i].publicKey,
          vaultPeriods[j].publicKey,
          vaultPeriods[k].publicKey,
        );
      } catch (e) {
        findError(
          e,
          new RegExp(".*Invalid vault-period"),
        ).should.not.be.undefined();
      }
    }
    await dripTrigger(vaultPeriods[1].publicKey, vaultPeriods[2].publicKey);
    for (const [i, j, k] of testCases) {
      try {
        await closePosition(
          vaultPeriods[i].publicKey,
          vaultPeriods[j].publicKey,
          vaultPeriods[k].publicKey,
        );
      } catch (e) {
        findError(
          e,
          new RegExp(".*Invalid vault-period"),
        ).should.not.be.undefined();
      }
    }
  });

  it("should not be able to close position more than once", async () => {
    let [i, j, k] = [0, 0, 4];
    await closePosition(
      vaultPeriods[i].publicKey,
      vaultPeriods[j].publicKey,
      vaultPeriods[k].publicKey,
    );
    const mint = await TokenUtil.fetchMint(userPositionNFTMint);
    const newUserPositionNFTAccount =
      await TokenUtil.getOrCreateAssociatedTokenAccount(
        mint,
        user.publicKey,
        user,
      );

    newUserPositionNFTAccount
      .toString()
      .should.equal(userPositionNFTAccount.toString());

    await closePosition(
      vaultPeriods[i].publicKey,
      vaultPeriods[j].publicKey,
      vaultPeriods[k].publicKey,
    ).should.be.rejectedWith(/0xbc4/);
  });
}
