import "should";
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
  sleep,
  triggerDCAWrapper,
} from "../utils/setup.util";
import { Token, u64 } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import { AccountUtil } from "../utils/Account.util";
import { findError } from "../utils/error.util";
import { initLog } from "../utils/log.util";

describe("#triggerDCA", testTriggerDCA);

export function testTriggerDCA() {
  initLog();

  let tokenOwnerKeypair: Keypair;
  let payerKeypair: Keypair;

  let user: Keypair;
  let userTokenAAccount: PublicKey;

  let bot: Keypair;
  let botTokenAAcount: PublicKey;

  let tokenA: Token;
  let tokenB: Token;

  let vaultProtoConfig: PublicKey;
  let vaultPDA: PDA;
  let vaultPeriods: PDA[];
  let vaultTokenAAccount: PublicKey;
  let vaultTokenBAccount: PublicKey;
  let vaultTreasuryTokenBAccount: PublicKey;

  // tokenA -> token B swap
  let swap: PublicKey;
  let swapTokenMint: PublicKey;
  let swapTokenAAccount: PublicKey;
  let swapTokenBAccount: PublicKey;
  let swapFeeAccount: PublicKey;
  let swapAuthority: PublicKey;

  // tokenB -> tokenA swap
  let swap2: PublicKey;
  let swapTokenMint2: PublicKey;
  let swapTokenAAccount2: PublicKey;
  let swapTokenBAccount2: PublicKey;
  let swapFeeAccount2: PublicKey;
  let swapAuthority2: PublicKey;

  // Non-whitelisted tokenA -> tokenB swap
  let swap3: PublicKey;
  let swapTokenMint3: PublicKey;
  let swapTokenAAccount3: PublicKey;
  let swapTokenBAccount3: PublicKey;
  let swapFeeAccount3: PublicKey;
  let swapAuthority3: PublicKey;

  let triggerDCA;

  beforeEach(async () => {
    // https://discord.com/channels/889577356681945098/889702325231427584/910244405443715092
    // sleep to progress to the next block
    await sleep(500);

    user = generatePair();
    bot = generatePair();
    [tokenOwnerKeypair, payerKeypair] = generatePairs(2);
    await Promise.all([
      SolUtils.fundAccount(user.publicKey, SolUtils.solToLamports(0.1)),
      SolUtils.fundAccount(bot.publicKey, SolUtils.solToLamports(0.1)),
      SolUtils.fundAccount(payerKeypair.publicKey, SolUtils.solToLamports(0.1)),
      SolUtils.fundAccount(
        tokenOwnerKeypair.publicKey,
        SolUtils.solToLamports(0.1)
      ),
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

    [
      swap2,
      swapTokenMint2,
      swapTokenAAccount2,
      swapTokenBAccount2,
      swapFeeAccount2,
      swapAuthority2,
    ] = await deploySwap(
      tokenB,
      tokenOwnerKeypair,
      tokenA,
      tokenOwnerKeypair,
      payerKeypair
    );

    [
      swap3,
      swapTokenMint3,
      swapTokenAAccount3,
      swapTokenBAccount3,
      swapFeeAccount3,
      swapAuthority3,
    ] = await deploySwap(
      tokenA,
      tokenOwnerKeypair,
      tokenB,
      tokenOwnerKeypair,
      payerKeypair
    );

    vaultProtoConfig = await deployVaultProtoConfig(
      1,
      5,
      5,
      tokenOwnerKeypair.publicKey
    );

    vaultTreasuryTokenBAccount = await TokenUtil.createTokenAccount(
      tokenB,
      payerKeypair.publicKey
    );

    vaultPDA = await deployVault(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTreasuryTokenBAccount,
      vaultProtoConfig,
      [swap, swap2]
    );

    [vaultTokenAAccount, vaultTokenBAccount] = await Promise.all([
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

    botTokenAAcount = await tokenA.createAssociatedTokenAccount(bot.publicKey);

    const depositAmount = await TokenUtil.scaleAmount(
      amount(1, Denom.Thousand),
      tokenA
    );
    await depositToVault(
      user,
      tokenA,
      depositAmount,
      new u64(4),
      vaultPDA.publicKey,
      vaultPeriods[4].publicKey,
      userTokenAAccount
    );

    triggerDCA = triggerDCAWrapper(
      bot,
      botTokenAAcount,
      vaultPDA.publicKey,
      vaultProtoConfig,
      vaultTokenAAccount,
      vaultTokenBAccount,
      tokenA.publicKey,
      tokenB.publicKey,
      swapTokenMint,
      swapTokenAAccount,
      swapTokenBAccount,
      swapFeeAccount,
      swapAuthority,
      swap
    );
  });

  it("should trigger DCA twice with expected TWAP and Balance values", async () => {
    await triggerDCA(vaultPeriods[0].publicKey, vaultPeriods[1].publicKey);

    let [
      vaultTokenAAccountAfter,
      vaultTokenBAccountAfter,
      botTokenAAccountAfter,
      vaultAfter,
      lastVaultPeriod,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(vaultTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(botTokenAAcount),
      AccountUtil.fetchVaultAccount(vaultPDA.publicKey),
      AccountUtil.fetchVaultPeriodAccount(vaultPeriods[1].publicKey),
    ]);

    vaultAfter.lastDcaPeriod.toString().should.equal("1");
    vaultTokenAAccountAfter.balance.toString().should.equal("750000000");
    vaultTokenBAccountAfter.balance.toString().should.equal("249063328");
    botTokenAAccountAfter.balance.toString().should.equal("125000");
    // Calculated manually by doing b/a
    lastVaultPeriod.twap.toString().should.equal("18386823290694860353");
    lastVaultPeriod.dcaTimestamp.toString().should.not.equal("0");

    await sleep(1500);
    await triggerDCA(vaultPeriods[1].publicKey, vaultPeriods[2].publicKey);

    [
      vaultTokenAAccountAfter,
      vaultTokenBAccountAfter,
      botTokenAAccountAfter,
      vaultAfter,
      lastVaultPeriod,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(vaultTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(botTokenAAcount),
      AccountUtil.fetchVaultAccount(vaultPDA.publicKey),
      AccountUtil.fetchVaultPeriodAccount(vaultPeriods[2].publicKey),
    ]);

    vaultAfter.lastDcaPeriod.toString().should.equal("2");
    vaultTokenAAccountAfter.balance.toString().should.equal("500000000");
    vaultTokenBAccountAfter.balance.toString().should.equal("498002435");
    botTokenAAccountAfter.balance.toString().should.equal("250000");
    lastVaultPeriod.twap.toString().should.equal("18382238052084394572");
  });

  it("should trigger DCA with inverted swap", async () => {
    await triggerDCAWrapper(
      bot,
      botTokenAAcount,
      vaultPDA.publicKey,
      vaultProtoConfig,
      vaultTokenAAccount,
      vaultTokenBAccount,
      tokenA.publicKey,
      tokenB.publicKey,
      swapTokenMint2,

      // Order swapped here
      swapTokenBAccount2,
      swapTokenAAccount2,

      swapFeeAccount2,
      swapAuthority2,
      swap2
    )(vaultPeriods[0].publicKey, vaultPeriods[1].publicKey);
  });

  it("should trigger DCA dca_cyles number of times", async () => {
    for (let i = 0; i < 4; i++) {
      await triggerDCA(
        vaultPeriods[i].publicKey,
        vaultPeriods[i + 1].publicKey
      );
      await sleep(1500);
    }

    const [
      vaultTokenAAccountAfter,
      vaultTokenBAccountAfter,
      botTokenAAccountAfter,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(vaultTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(botTokenAAcount),
    ]);
    vaultTokenAAccountAfter.balance.toString().should.equal("0");
    vaultTokenBAccountAfter.balance.toString().should.equal("995508358");
    botTokenAAccountAfter.balance.toString().should.equal("500000");
  });

  it("should fail to trigger DCA if vault token A balance is 0", async () => {
    for (let i = 0; i < 4; i++) {
      await triggerDCA(
        vaultPeriods[i].publicKey,
        vaultPeriods[i + 1].publicKey
      );
      await sleep(1500);
    }
    try {
      await triggerDCA(vaultPeriods[4].publicKey, vaultPeriods[5].publicKey);
    } catch (e) {
      findError(
        e,
        new RegExp(".*Periodic drip amount == 0")
      ).should.not.be.undefined();
    }
  });

  it("should fail if we trigger twice in the same granularity", async () => {
    await triggerDCA(vaultPeriods[0].publicKey, vaultPeriods[1].publicKey);
    try {
      await triggerDCA(vaultPeriods[1].publicKey, vaultPeriods[2].publicKey);
    } catch (e) {
      findError(
        e,
        new RegExp(".*DCA already triggered for the current period")
      ).should.not.be.undefined();
    }
  });

  it("should fail if non-whitelisted swaps is used", async () => {
    try {
      await triggerDCAWrapper(
        bot,
        botTokenAAcount,
        vaultPDA.publicKey,
        vaultProtoConfig,
        vaultTokenAAccount,
        vaultTokenBAccount,
        tokenA.publicKey,
        tokenB.publicKey,
        swapTokenMint3,
        swapTokenAAccount3,
        swapTokenBAccount3,
        swapFeeAccount3,
        swapAuthority3,
        swap3
      )(vaultPeriods[0].publicKey, vaultPeriods[1].publicKey);
    } catch (e) {
      findError(
        e,
        new RegExp(".*Token Swap is Not Whitelisted")
      ).should.not.be.undefined();
    }
  });
}
