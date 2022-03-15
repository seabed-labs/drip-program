import { SolUtils } from "../utils/SolUtils";
import { TokenUtil } from "../utils/Token.util";
import {
  findAssociatedTokenAddress,
  generatePairs,
  PDA,
} from "../utils/common.util";
import {
  deploySwap,
  deployVault,
  deployVaultPeriod,
  deployVaultProtoConfig,
  depositWithNewUserWrapper,
  sleep,
} from "../utils/setup.util";
import { Token } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";

export function setupKeeperBot() {
  let tokenOwnerKeypair: Keypair;
  let payerKeypair: Keypair;

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

  let depositWithNewUser;

  before(async () => {
    // https://discord.com/channels/889577356681945098/889702325231427584/910244405443715092
    // sleep to progress to the next block
    await sleep(500);

    [tokenOwnerKeypair, payerKeypair] = generatePairs(2);
    await Promise.all([
      SolUtils.fundAccount(payerKeypair.publicKey, 1000000000),
      SolUtils.fundAccount(tokenOwnerKeypair.publicKey, 1000000000),
    ]);

    console.log("tokenOwnerKeypair:", {
      publicKey: tokenOwnerKeypair.publicKey.toString(),
      secretKey: tokenOwnerKeypair.secretKey.toString(),
    });

    console.log("payerKeypair:", {
      publicKey: payerKeypair.publicKey.toString(),
      secretKey: payerKeypair.secretKey.toString(),
    });

    tokenA = await TokenUtil.createMint(
      tokenOwnerKeypair.publicKey,
      null,
      6,
      payerKeypair
    );
    console.log("tokenAMint:", tokenA.publicKey.toBase58());

    tokenB = await TokenUtil.createMint(
      tokenOwnerKeypair.publicKey,
      null,
      6,
      payerKeypair
    );
    console.log("tokenBMint:", tokenB.publicKey.toBase58());

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
    console.log("swap:", swap.toBase58());
    console.log("swapTokenMint:", swapTokenMint.toBase58());
    console.log("swapTokenAAccount:", swapTokenAAccount.toBase58());
    console.log("swapTokenBAccount:", swapTokenBAccount.toBase58());
    console.log("swapFeeAccount:", swapFeeAccount.toBase58());
    console.log("swapAuthority:", swapAuthority.toBase58());

    vaultProtoConfig = await deployVaultProtoConfig(1);
    console.log("vaultProtoConfig:", vaultProtoConfig.toBase58());

    vaultPDA = await deployVault(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultProtoConfig
    );
    console.log("vault:", vaultPDA.publicKey.toBase58());

    [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
    ]);
    console.log("vaultTokenAAccount:", vaultTokenA_ATA.toBase58());
    console.log("vaultTokenBAccount:", vaultTokenB_ATA.toBase58());

    const numPeriods = 101;
    vaultPeriods = await Promise.all(
      [...Array(numPeriods).keys()].map((i) =>
        deployVaultPeriod(
          vaultProtoConfig,
          vaultPDA.publicKey,
          tokenA.publicKey,
          tokenB.publicKey,
          i
        )
      )
    );
    console.log(`deployed ${numPeriods} vault periods`);

    depositWithNewUser = depositWithNewUserWrapper(
      vaultPDA.publicKey,
      tokenOwnerKeypair,
      tokenA
    );

    for (let i = 1; i < 11; i++) {
      await depositWithNewUser({
        dcaCycles: i * 10,
        newUserEndVaultPeriod: vaultPeriods[i * 10].publicKey,
        mintAmount: i,
      });
    }
  });

  it("sets up keeper bot dependencies", async () => {
    true.should.be.true();
  });
}
