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

  beforeEach(async () => {
    // https://discord.com/channels/889577356681945098/889702325231427584/910244405443715092
    // sleep to progress to the next block
    await sleep(500);

    user = generatePair();
    const [tokenOwnerKeypair, payerKeypair] = generatePairs(2);
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
  });

  it("should trigger DCA twice with expected TWAP and Balance values", async () => {
    await trigerDCA(vaultPeriods[0].publicKey, vaultPeriods[1].publicKey);

    let [
      vaultTokenA_ATA_After,
      vaultTokenB_ATA_After,
      vaultAfter,
      lastVaultPeriod,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(vaultTokenA_ATA),
      TokenUtil.fetchTokenAccountInfo(vaultTokenB_ATA),
      AccountUtil.fetchVaultAccount(vaultPDA.publicKey),
      AccountUtil.fetchVaultPeriodAccount(vaultPeriods[1].publicKey),
    ]);

    vaultAfter.lastDcaPeriod.toString().should.equal("1");
    vaultTokenA_ATA_After.balance.toString().should.equal("750000000");
    vaultTokenB_ATA_After.balance.toString().should.equal("249187889");
    // Calculated manually by doing b/a
    lastVaultPeriod.twap.toString().should.equal("18386820858603774265");

    await sleep(1500);
    await trigerDCA(vaultPeriods[1].publicKey, vaultPeriods[2].publicKey);

    [
      vaultTokenA_ATA_After,
      vaultTokenB_ATA_After,
      vaultAfter,
      lastVaultPeriod,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(vaultTokenA_ATA),
      TokenUtil.fetchTokenAccountInfo(vaultTokenB_ATA),
      AccountUtil.fetchVaultAccount(vaultPDA.publicKey),
      AccountUtil.fetchVaultPeriodAccount(vaultPeriods[2].publicKey),
    ]);

    vaultAfter.lastDcaPeriod.toString().should.equal("2");
    vaultTokenA_ATA_After.balance.toString().should.equal("500000000");
    vaultTokenB_ATA_After.balance.toString().should.equal("498251433");
    // Swap price in this period is 18377645817036392608
    // Value calcualted manually using previous twap value and the new price from this period
    lastVaultPeriod.twap.toString().should.equal("18382233337820083436");
  });

  it("should trigger DCA dca_cyles number of times", async () => {
    for (let i = 0; i < 4; i++) {
      await trigerDCA(vaultPeriods[i].publicKey, vaultPeriods[i + 1].publicKey);
      await sleep(1500);
    }

    const [vaultTokenA_ATA_After, vaultTokenB_ATA_After] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(vaultTokenA_ATA),
      TokenUtil.fetchTokenAccountInfo(vaultTokenB_ATA),
    ]);
    vaultTokenA_ATA_After.balance.toString().should.equal("0");
    vaultTokenB_ATA_After.balance.toString().should.equal("996005860");
  });

  it("should fail to trigger DCA if vault token A balance is 0", async () => {
    for (let i = 0; i < 4; i++) {
      await trigerDCA(vaultPeriods[i].publicKey, vaultPeriods[i + 1].publicKey);
      await sleep(1500);
    }
    await trigerDCA(
      vaultPeriods[4].publicKey,
      vaultPeriods[5].publicKey
    ).should.rejectedWith(new RegExp(".*Periodic drip amount == 0"));
  });

  it("should fail if we trigger twice in the same granularity", async () => {
    await trigerDCA(vaultPeriods[0].publicKey, vaultPeriods[1].publicKey);
    await trigerDCA(
      vaultPeriods[1].publicKey,
      vaultPeriods[2].publicKey
    ).should.rejectedWith(
      new RegExp(
        ".*DCA already triggered for the current period. Duplicate DCA triggers not allowed"
      )
    );
  });
}
