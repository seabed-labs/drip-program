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
import fs from "fs";
import YAML from "yaml";

export function setupKeeperBot() {
  let tokenOwnerKeypair: Keypair;
  let payerKeypair: Keypair;

  let tokenA: Token;
  let tokenB: Token;
  let swap: PublicKey;
  let vaultProtoConfig: PublicKey;
  let vaultPDA: PDA;
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

    vaultProtoConfig = await deployVaultProtoConfig(5);
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

    depositWithNewUser = depositWithNewUserWrapper(
      vaultPDA.publicKey,
      tokenOwnerKeypair,
      tokenA
    );

    await deployVaultPeriod(
      vaultProtoConfig,
      vaultPDA.publicKey,
      tokenA.publicKey,
      tokenB.publicKey,
      0
    );
    for (let i = 1; i < 11; i++) {
      const newUserEndVaultPeriod = await deployVaultPeriod(
        vaultProtoConfig,
        vaultPDA.publicKey,
        tokenA.publicKey,
        tokenB.publicKey,
        i * 10
      );
      await depositWithNewUser({
        dcaCycles: i * 10,
        newUserEndVaultPeriod: newUserEndVaultPeriod.publicKey,
        mintAmount: i,
      });
    }

    const localConfig = {
      environment: "LOCALNET",
      triggerDCA: [
        {
          vault: vaultPDA.publicKey.toBase58(),
          vaultProtoConfig: vaultProtoConfig.toBase58(),
          vaultTokenAAccount: vaultTokenA_ATA.toBase58(),
          vaultTokenBAccount: vaultTokenB_ATA.toBase58(),
          tokenAMint: tokenA.publicKey.toBase58(),
          tokenBMint: tokenB.publicKey.toBase58(),
          swapTokenMint: swapTokenMint.toBase58(),
          swapTokenAAccount: swapTokenAAccount.toBase58(),
          swapTokenBAccount: swapTokenBAccount.toBase58(),
          swapFeeAccount: swapFeeAccount.toBase58(),
          swapAuthority: swapAuthority.toBase58(),
          swap: swap.toBase58(),
        },
      ],
    };
    fs.writeFileSync(
      "../keeper-bot/configs/localnet.yaml",
      YAML.stringify(localConfig)
    );
  });

  it("sets up keeper bot dependencies", async () => {
    true.should.be.true();
  });
}
