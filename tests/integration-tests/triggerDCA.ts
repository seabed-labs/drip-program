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

export function testTriggerDCA() {
  let user: Keypair;
  let userTokenAAccount: PublicKey;

  let bot: Keypair;
  let botTokenAAcount: PublicKey;

  let tokenA: Token;
  let tokenB: Token;

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

  let triggerDCA;

  beforeEach(async () => {
    // https://discord.com/channels/889577356681945098/889702325231427584/910244405443715092
    // sleep to progress to the next block
    await sleep(500);

    user = generatePair();
    bot = generatePair();
    const [tokenOwnerKeypair, payerKeypair] = generatePairs(2);
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

    vaultProtoConfig = await deployVaultProtoConfig(1, 5, 5);

    vaultTreasuryTokenBAccount = await TokenUtil.createTokenAccount(
      tokenB,
      payerKeypair.publicKey
    );

    vaultPDA = await deployVault(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTreasuryTokenBAccount,
      vaultProtoConfig
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
    await triggerDCA(
      vaultPeriods[4].publicKey,
      vaultPeriods[5].publicKey
    ).should.rejectedWith(new RegExp(".*Periodic drip amount == 0"));
  });

  it("should fail if we trigger twice in the same granularity", async () => {
    await triggerDCA(vaultPeriods[0].publicKey, vaultPeriods[1].publicKey);
    await triggerDCA(
      vaultPeriods[1].publicKey,
      vaultPeriods[2].publicKey
    ).should.rejectedWith(
      new RegExp(".*DCA already triggered for the current period")
    );
  });
}
