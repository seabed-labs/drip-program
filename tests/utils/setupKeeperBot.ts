// import "should";
// import { SolUtil } from "./sol.util";
// import { TokenUtil } from "./token.util";
// import { generatePairs } from "./common.util";
// import {
//   deploySPLTokenSwap,
//   deployVault,
//   deployVaultPeriod,
//   deployVaultProtoConfig,
//   sleep,
// } from "./setup.util";
// import { Keypair, PublicKey } from "@solana/web3.js";
// import { DeployWhirlpoolRes, WhirlpoolUtil } from "./whirlpool.util";
// import { MathUtil } from "@orca-so/common-sdk";
// import Decimal from "decimal.js";

// describe("#setupKeeperBot", setupKeeperBot);

// export function setupKeeperBot() {
//   before(async () => {
//     const [payerKeypair] = generatePairs(2);
//     console.log(process.env.TOKEN_OWNER_KEYPAIR);
//     const keypairData = process.env.TOKEN_OWNER_KEYPAIR;
//     const programID = Uint8Array.from(JSON.parse(keypairData));
//     const tokenOwnerKeypair = Keypair.fromSecretKey(programID);

//     await Promise.all([
//       await SolUtil.fundAccount(
//         payerKeypair.publicKey,
//         SolUtil.solToLamports(0.5),
//       ),
//       SolUtil.fundAccount(
//         tokenOwnerKeypair.publicKey,
//         SolUtil.solToLamports(0.5),
//       ),
//     ]);

//     console.log("tokenOwnerKeypair:", {
//       publicKey: tokenOwnerKeypair.publicKey.toString(),
//       secretKey: tokenOwnerKeypair.secretKey.toString(),
//     });

//     console.log("payerKeypair:", {
//       publicKey: payerKeypair.publicKey.toString(),
//       secretKey: payerKeypair.secretKey.toString(),
//     });

//     const tokens = [];
//     tokens.push(
//       ...(await Promise.all([
//         // USDT
//         TokenUtil.createMint(
//           tokenOwnerKeypair.publicKey,
//           null,
//           6,
//           payerKeypair,
//         ),
//         // BTC
//         TokenUtil.createMint(
//           tokenOwnerKeypair.publicKey,
//           null,
//           6,
//           payerKeypair,
//         ),
//       ])),
//     );
//     for (const token of tokens) {
//       console.log(token.publicKey.toString());
//     }
//     const tokenNames = ["USDC", "BTC"];

//     let protoConfigs: Record<number, PublicKey> = {};
//     // create configs
//     for (const granularity of [60, 3600, 86400]) {
//       protoConfigs[granularity] = await deployVaultProtoConfig(
//         granularity,
//         5,
//         5,
//         10,
//         tokenOwnerKeypair.publicKey,
//       );
//     }

//     // deploy swaps
//     let tokenA = tokens[0];

//     // usdc - btc
//     let tokenB = tokens[1];
//     let splTokenSwapKeys = await deploySPLTokenSwap(
//       tokenA,
//       tokenOwnerKeypair,
//       tokenB,
//       tokenOwnerKeypair,
//       payerKeypair,
//       {
//         a: BigInt(20000),
//         b: BigInt(1),
//       },
//     );
//     console.log("usdc - btc splTokenSwap", splTokenSwapKeys[0].toString());

//     // deploy whirlpools
//     tokenA = tokens[0];

//     // usdc - btc
//     tokenB = tokens[1];
//     // Current BTC/USDC price
//     let desiredMarketPrice = new Decimal(20000);
//     // Invert due to token mint ordering
//     let actualPrice = new Decimal(1).div(desiredMarketPrice);
//     // Shift by 64 bits
//     let initSqrtPrice = MathUtil.toX64(actualPrice);
//     let whirlpool = await WhirlpoolUtil.deployWhirlpool({
//       tokenA,
//       tokenB,
//       tokenOwnerKeypair,
//       // initSqrtPrice, Error: byte array longer than desired length error on devnet
//     });
//     console.log(
//       "usdc - btc whirlpool",
//       whirlpool.initWhirlpoolRes.whirlpool.toString(),
//     );
//     console.log(
//       "minta - mintb",
//       whirlpool.initWhirlpoolRes.tokenMintA.toBase58(),
//       whirlpool.initWhirlpoolRes.tokenMintB.toBase58(),
//     );

//     // for (const [granularity, vaultProtoConfig] of Object.entries(
//     //   protoConfigs
//     // )) {
//     //   for (let i = 0; i < tokens.length; i++) {
//     //     const tokenA = tokens[i];
//     //     const tokenASymbol = tokenNames[i];
//     //     for (let j = 0; j < tokens.length; j++) {
//     //       await sleep(500);
//     //       if (i == j) continue;
//     //       const tokenB = tokens[j];
//     //       const tokenBSymbol = tokenNames[j];

//     //       try {
//     //         const vaultTreasuryTokenBAccount =
//     //           await TokenUtil.createTokenAccount(
//     //             tokenB,
//     //             payerKeypair.publicKey
//     //           );
//     //         console.log(
//     //           "creating config",
//     //           tokenA.publicKey.toBase58(),
//     //           tokenASymbol,
//     //           tokenB.publicKey.toBase58(),
//     //           tokenBSymbol,
//     //           vaultProtoConfig.toBase58(),
//     //           granularity
//     //         );

//     //         const vaultPDA = await deployVault(
//     //           tokenA.publicKey,
//     //           tokenB.publicKey,
//     //           vaultTreasuryTokenBAccount,
//     //           vaultProtoConfig
//     //         );
//     //         await deployVaultPeriod(
//     //           vaultProtoConfig,
//     //           vaultPDA.publicKey,
//     //           tokenA.publicKey,
//     //           tokenB.publicKey,
//     //           0
//     //         );

//     //         console.log(
//     //           "token A",
//     //           tokenA.publicKey.toBase58(),
//     //           tokenASymbol,
//     //           "token b",
//     //           tokenB.publicKey.toBase58(),
//     //           tokenBSymbol,
//     //           "protoConfig",
//     //           vaultProtoConfig.toBase58(),
//     //           granularity,
//     //           "vault",
//     //           vaultPDA.publicKey.toBase58()
//     //         );
//     //       } catch (e) {
//     //         console.log("error deploying", e);
//     //       }
//     //     }
//     //   }
//     // }
//   });

//   it("setup vaults", async () => {
//     true.should.be.true();
//   });
// }
