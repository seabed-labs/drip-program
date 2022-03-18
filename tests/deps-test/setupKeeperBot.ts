import { SolUtils } from "../utils/SolUtils";
import { TokenUtil } from "../utils/Token.util";
import {
  amount,
  Denom,
  findAssociatedTokenAddress,
  generatePairs,
  Granularity,
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

  // let depositWithNewUser;

  let config = 0;

  before(async () => {
    [tokenOwnerKeypair, payerKeypair] = generatePairs(2);
    await Promise.all([
      SolUtils.fundAccount(payerKeypair.publicKey, SolUtils.lamportsToSol(0.1)),
      SolUtils.fundAccount(
        tokenOwnerKeypair.publicKey,
        SolUtils.lamportsToSol(0.1)
      ),
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
  });

  beforeEach(async () => {
    config += 1;
    // https://discord.com/channels/889577356681945098/889702325231427584/910244405443715092
    // sleep to progress to the next block
    await sleep(500);

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

    for (const granularity of [60, 3600, 86400, 604800, 2592000]) {
      vaultProtoConfig = await deployVaultProtoConfig(granularity);
      console.log("vaultProtoConfig:", vaultProtoConfig.toBase58());

      vaultPDA = await deployVault(
        tokenA.publicKey,
        tokenB.publicKey,
        vaultProtoConfig
      );
      console.log("vault:", vaultPDA.publicKey.toBase58());
    }

    [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
    ]);
    console.log("vaultTokenAAccount:", vaultTokenA_ATA.toBase58());
    console.log("vaultTokenBAccount:", vaultTokenB_ATA.toBase58());

    for (const testWallet of [
      "8XHtH5q5TyuFCcSkVjKW7jqE26ta2e7rXDnSLEHAgjD2",
      "42Wfx1vHs571B5KwhB6SFrsBiNTSkr9YhJm37WHtU6v9",
      "BJmuWLetrZRm2ADpDVxArg6CovgUwxgYESV5GHVDwnHi",
    ]) {
      const testTokenAAccount = await tokenA.createAssociatedTokenAccount(
        new PublicKey(testWallet)
      );
      await tokenA.mintTo(
        testTokenAAccount,
        tokenOwnerKeypair,
        [],
        await TokenUtil.scaleAmount(amount(100, Denom.Million), tokenA)
      );
      console.log("funded testAccount account for token A", {
        wallet: testTokenAAccount,
        tokenAMint: tokenA,
      });
    }

    await deployVaultPeriod(
      vaultProtoConfig,
      vaultPDA.publicKey,
      tokenA.publicKey,
      tokenB.publicKey,
      0
    );

    const localConfig = {
      environment: process.env.ENV ?? "LOCALNET",
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
      `../keeper-bot/configs/setup${config}.yaml`,
      YAML.stringify(localConfig)
    );
  });

  it("setup first vault", async () => {
    true.should.be.true();
  });
  it("setup second vault", async () => {
    true.should.be.true();
  });
  it("setup third vault", async () => {
    true.should.be.true();
  });
  it("setup fourth vault", async () => {
    true.should.be.true();
  });
  it("setup fifth vault", async () => {
    true.should.be.true();
  });
}
