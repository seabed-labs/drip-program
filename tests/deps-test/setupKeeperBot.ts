import { SolUtils } from "../utils/SolUtils";
import { TokenUtil } from "../utils/Token.util";
import {
  amount,
  Denom,
  findAssociatedTokenAddress,
  generatePairs,
} from "../utils/common.util";
import {
  deploySwap,
  deployVault,
  deployVaultPeriod,
  deployVaultProtoConfig,
  sleep,
} from "../utils/setup.util";
import { PublicKey } from "@solana/web3.js";
import fs from "fs";
import YAML from "yaml";

export function setupKeeperBot() {
  before(async () => {
    const testWallets = [
      "8XHtH5q5TyuFCcSkVjKW7jqE26ta2e7rXDnSLEHAgjD2",
      "42Wfx1vHs571B5KwhB6SFrsBiNTSkr9YhJm37WHtU6v9",
      "BJmuWLetrZRm2ADpDVxArg6CovgUwxgYESV5GHVDwnHi",
    ];

    const [tokenOwnerKeypair, payerKeypair] = generatePairs(2);
    await Promise.all([
      await SolUtils.fundAccount(
        payerKeypair.publicKey,
        SolUtils.solToLamports(0.5)
      ),
      SolUtils.fundAccount(
        tokenOwnerKeypair.publicKey,
        SolUtils.solToLamports(0.5)
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

    const tokens = [];
    tokens.push(
      ...(await Promise.all([
        TokenUtil.createMint(
          tokenOwnerKeypair.publicKey,
          null,
          6,
          payerKeypair,
          false
        ),
        TokenUtil.createMint(
          tokenOwnerKeypair.publicKey,
          null,
          9,
          payerKeypair,
          false
        ),
        TokenUtil.createMint(
          tokenOwnerKeypair.publicKey,
          null,
          9,
          payerKeypair,
          false
        ),
      ]))
    );

    const tokenNames = ["USDC", "SOL", "ETH"];
    // usdc, sol, 60
    // usdc, sol, 3600
    // usdc, sol, 86400
    // eth, usdc, 60
    // sol, usdc 3600
    // eth, usdc 86400
    // sol, usdc 86400
    for (const token of tokens) {
      for (const testWallet of testWallets) {
        const testTokenAAccount = await token.createAssociatedTokenAccount(
          new PublicKey(testWallet)
        );
        await token.mintTo(
          testTokenAAccount,
          tokenOwnerKeypair,
          [],
          await TokenUtil.scaleAmount(amount(100, Denom.Thousand), token)
        );
        console.log("funded testAccount account with tokens", {
          wallet: testWallet,
          mint: token.publicKey.toString(),
        });
      }
    }

    const configs = [];
    for (const granularity of [60, 3600, 86400]) {
      const vaultProtoConfig = await deployVaultProtoConfig(granularity, 5, 5);
      for (let i = 0; i < tokens.length; i++) {
        const tokenB = tokens[i];
        const tokenBSymbol = tokenNames[i];
        const vaultTreasuryTokenBAccount = await TokenUtil.createTokenAccount(
          tokenB,
          payerKeypair.publicKey
        );

        for (let j = 0; j < tokens.length; j++) {
          if (i == j) continue;
          await sleep(500);
          try {
            const tokenA = tokens[j];
            const tokenASymbol = tokenNames[j];
            console.log(
              "creating config",
              tokenA.publicKey.toBase58(),
              tokenASymbol,
              tokenB.publicKey.toBase58(),
              tokenBSymbol,
              vaultProtoConfig.toBase58(),
              granularity
            );

            const [
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
              payerKeypair,
              // TODO(mocha): use a hard coded map so that token a -> token b price makes sense
              {
                a: 100,
                b: 1,
              }
            );

            const vaultPDA = await deployVault(
              tokenA.publicKey,
              tokenB.publicKey,
              vaultTreasuryTokenBAccount,
              vaultProtoConfig
            );
            const [vaultTokenAAccount, vaultTokenBAccount] = await Promise.all([
              findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
              findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
            ]);

            await deployVaultPeriod(
              vaultProtoConfig,
              vaultPDA.publicKey,
              tokenA.publicKey,
              tokenB.publicKey,
              0
            );
            const config = {
              vault: vaultPDA.publicKey.toBase58(),
              vaultProtoConfig: vaultProtoConfig.toBase58(),
              vaultProtoConfigGranularity: granularity,
              vaultTokenAAccount: vaultTokenAAccount.toBase58(),
              vaultTokenBAccount: vaultTokenBAccount.toBase58(),
              vaultTreasuryTokenBAccount: vaultTreasuryTokenBAccount.toBase58(),
              tokenAMint: tokenA.publicKey.toBase58(),
              tokenASymbol: tokenASymbol,
              tokenBMint: tokenB.publicKey.toBase58(),
              tokenBSymbol: tokenBSymbol,
              swapTokenMint: swapTokenMint.toBase58(),
              swapTokenAAccount: swapTokenAAccount.toBase58(),
              swapTokenBAccount: swapTokenBAccount.toBase58(),
              swapFeeAccount: swapFeeAccount.toBase58(),
              swapAuthority: swapAuthority.toBase58(),
              swap: swap.toBase58(),
            };
            configs.push(config);
          } catch (e) {
            console.log("error deploying", e);
          }
        }
      }
    }

    const environment = process.env.ENV ?? "LOCALNET";
    const keeperBotConfig = {
      environment,
      triggerDCA: configs,
    };
    if (fs.existsSync("../keeper-bot/configs/")) {
      if (fs.existsSync(`../keeper-bot/configs/${environment}.yaml`)) {
        fs.renameSync(
          `../keeper-bot/configs/${environment}.yaml`,
          `../keeper-bot/configs/${environment}_old.yaml`
        );
      }
      fs.writeFileSync(
        `../keeper-bot/configs/${environment}.yaml`,
        YAML.stringify(keeperBotConfig)
      );
    } else {
      fs.writeFileSync(
        `./keeper-bot_${environment}.yaml`,
        YAML.stringify(keeperBotConfig)
      );
    }

    const frontendConfig = configs;
    if (fs.existsSync("../frontend/src/")) {
      if (fs.existsSync(`../frontend/src/config.json`)) {
        fs.renameSync(
          `../frontend/src/config.json`,
          `../frontend/src/config_old.json`
        );
      }
      fs.writeFileSync(
        `../frontend/src/config.json`,
        JSON.stringify(frontendConfig, null, 2)
      );
    } else {
      fs.writeFileSync(
        `./frontend_config.json`,
        JSON.stringify(frontendConfig, null, 2)
      );
    }
  });

  it("setup vaults", async () => {
    true.should.be.true();
  });
}
