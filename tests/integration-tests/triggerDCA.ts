import { SolUtils } from "../utils/SolUtils";
import { MintToParams, TokenUtil } from "../utils/Token.util";
import {
  amount,
  Denom,
  findAssociatedTokenAddress,
  generatePair,
  generatePairs,
  Granularity,
  PDA,
} from "../utils/common.util";
import {
  deploySwap,
  deployVault,
  deployVaultPeriod,
  deployVaultProtoConfig,
  depositToVault,
} from "../utils/instruction.util";
import { Token, u64 } from "@solana/spl-token";
import { Keypair, PublicKey, Signer } from "@solana/web3.js";
import { VaultUtil } from "../utils/Vault.util";
import { AccountUtil } from "../utils/Account.util";
import { BN } from "@project-serum/anchor";

export function testTriggerDCA() {
  let user: Keypair;
  let userTokenAAccount: PublicKey;
  let userTokenBAccount: PublicKey;
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

  beforeEach(async () => {
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

    vaultProtoConfig = await deployVaultProtoConfig(Granularity.HOURLY);

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
      [...Array(5).keys()].map((i) =>
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
    await depositToVault(
      user,
      tokenA,
      depositAmount,
      new u64(4),
      vaultPDA.publicKey,
      vaultPeriods[4].publicKey,
      userTokenAAccount
    );
  });

  it.only("happy path", async () => {
    const startTime = Math.floor(new Date().getTime() / 1000);
    await VaultUtil.triggerDCA(
      user,
      vaultPDA.publicKey,
      vaultProtoConfig,
      vaultTokenA_ATA,
      vaultTokenB_ATA,
      vaultPeriods[0].publicKey,
      vaultPeriods[1].publicKey,
      tokenA.publicKey,
      tokenB.publicKey,
      swapTokenMint,
      swapTokenAAccount,
      swapTokenBAccount,
      swapFeeAccount,
      swapAuthority,
      swap
    );

    const [
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
    console.log("vaultTokenA_ATA_After:", vaultTokenA_ATA_After);
    console.log("vaultTokenB_ATA_After:", vaultTokenB_ATA_After);
    console.log("vaultAfter:", vaultAfter);
    console.log("vaultAfter Drip:", vaultAfter.dripAmount.toString());
    console.log("lastVaultPeriod:", lastVaultPeriod);

    const depositAmount = await TokenUtil.scaleAmount(
      amount(2, Denom.Thousand),
      tokenA
    );

    // received b 249187889
    // vault drip 250000000

    vaultAfter.lastDcaPeriod.toString().should.equal("1");
    vaultAfter.dcaActivationTimestamp.should.be.greaterThan(startTime);
    vaultTokenA_ATA_After.balance.toString().should.not.equal(depositAmount.toString());
    vaultTokenB_ATA_After.balance.toString().should.equal("0");
    // TODO(Mocha): check the actual twap value matches our expected value
    // lastVaultPeriod.twap.should.not.equal("0");
  });

  it("should fail if we trigger twice in the same granularity", async () => {
    await VaultUtil.triggerDCA(
      user,
      vaultPDA.publicKey,
      vaultProtoConfig,
      vaultTokenA_ATA,
      vaultTokenB_ATA,
      vaultPeriods[0].publicKey,
      vaultPeriods[1].publicKey,
      tokenA.publicKey,
      tokenB.publicKey,
      swapTokenMint,
      swapTokenAAccount,
      swapTokenBAccount,
      swapFeeAccount,
      swapAuthority,
      swap
    );
    await VaultUtil.triggerDCA(
      user,
      vaultPDA.publicKey,
      vaultProtoConfig,
      vaultTokenA_ATA,
      vaultTokenB_ATA,
      vaultPeriods[1].publicKey,
      vaultPeriods[2].publicKey,
      tokenA.publicKey,
      tokenB.publicKey,
      swapTokenMint,
      swapTokenAAccount,
      swapTokenBAccount,
      swapFeeAccount,
      swapAuthority,
      swap
    ).should.rejectedWith(
      new RegExp(
        ".*DCA already triggered for the current period. Duplicate DCA triggers not allowed"
      )
    );
  });
}
