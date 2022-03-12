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
      2,
      payerKeypair
    );

    tokenB = await TokenUtil.createMint(
      tokenOwnerKeypair.publicKey,
      null,
      2,
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
    await tokenA.mintTo(userTokenAAccount, tokenOwnerKeypair, [], 4000000);
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

  it("sanity", async () => {
    console.log('VAULT:', vaultPDA.publicKey.toBase58());
    console.log('SWAP:', swap.toBase58());
    console.log('SWAP AUTHORITY:', swapAuthority.toBase58());
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
    true.should.equal(true);
  });
}
