// import "should";
// import { SolUtil } from "./sol.util";
// import { TokenUtil } from "./token.util";
// import { Keypair, PublicKey } from "@solana/web3.js";
// import { WhirlpoolUtil } from "./whirlpool.util";
// import { Percentage } from "@orca-so/common-sdk";
// import Decimal from "decimal.js";
// import {
//   buildWhirlpoolClient,
//   increaseLiquidityQuoteByInputToken,
//   PDAUtil,
//   TICK_ARRAY_SIZE,
//   toTx,
//   WhirlpoolIx,
// } from "@orca-so/whirlpools-sdk";
// import { ProgramUtil } from "./program.util";
// import { amount, Denom } from "./common.util";
// import { getAssociatedTokenAddressSync } from "@solana/spl-token";

// describe("#setupWhirlpool", setupWhirlpool);

// export function setupWhirlpool() {
//   before(async () => {
//     const poolAddress = "5fkps3wttvX3ysprtWzLRuxajSkmdxEa12Ys8E4bMTPh";
//     // fetch whirlpool
//     const whirlpool = new PublicKey(poolAddress);
//     const whirlpoolClient = buildWhirlpoolClient(WhirlpoolUtil.whirlpoolCtx);
//     const whirlpoolData = await whirlpoolClient.getPool(whirlpool);

//     const keypairData = process.env.TOKEN_OWNER_KEYPAIR;
//     const tokenOwnerKeypair = Keypair.fromSecretKey(
//       Uint8Array.from(JSON.parse(keypairData)),
//     );
//     // const [payerKeypair] = generatePairs(1);
//     const [payerKeypair] = [tokenOwnerKeypair];

//     await Promise.all([
//       await SolUtil.fundAccount(
//         payerKeypair.publicKey,
//         SolUtil.solToLamports(0.2),
//       ),
//       SolUtil.fundAccount(
//         tokenOwnerKeypair.publicKey,
//         SolUtil.solToLamports(0.2),
//       ),
//     ]);

//     // Mint Tokens to Random Wallet

//     const tokenAMintPubkey = whirlpoolData.getData().tokenMintA;
//     const tokenA = await TokenUtil.fetchMint(tokenAMintPubkey);
//     const tokenAAccount = await TokenUtil.getOrCreateAssociatedTokenAccount(
//       tokenA,
//       payerKeypair.publicKey,
//       payerKeypair,
//     );
//     console.log(
//       "tokenMintA",
//       tokenAMintPubkey.toString(),
//       "tokenAAccount",
//       tokenAAccount.toString(),
//     );
//     const mintAmountA = await TokenUtil.scaleAmount(
//       amount(50, Denom.Million),
//       tokenA,
//     );
//     await TokenUtil.mintTo({
//       payer: tokenOwnerKeypair,
//       token: tokenA,
//       mintAuthority: tokenOwnerKeypair,
//       recipient: tokenAAccount,
//       amount: mintAmountA,
//     });

//     const tokenBMintPubkey = whirlpoolData.getData().tokenMintB;
//     const tokenB = await TokenUtil.fetchMint(tokenBMintPubkey);

//     const tokenBAccount = await TokenUtil.getOrCreateAssociatedTokenAccount(
//       tokenB,
//       payerKeypair.publicKey,
//       payerKeypair,
//     );
//     console.log(
//       "tokenMintB",
//       tokenBMintPubkey.toString(),
//       "tokenBAccount",
//       tokenBAccount.toString(),
//     );
//     const mintAmountB = await TokenUtil.scaleAmount(
//       amount(50, Denom.Million),
//       tokenB,
//     );
//     await TokenUtil.mintTo({
//       payer: tokenOwnerKeypair,
//       token: tokenB,
//       mintAuthority: tokenOwnerKeypair,
//       recipient: tokenBAccount,
//       amount: mintAmountB,
//     });

//     // Open position
//     const positionMintKeypair = Keypair.generate();
//     const positionPda = PDAUtil.getPosition(
//       ProgramUtil.orcaWhirlpoolProgram.programId,
//       positionMintKeypair.publicKey,
//     );
//     const positionTokenAccount = await getAssociatedTokenAddressSync(
//       positionMintKeypair.publicKey,
//       payerKeypair.publicKey,
//     );

//     const initAtoB = await WhirlpoolUtil.initTickArrayRange(
//       whirlpool,
//       whirlpoolData.getData().tickCurrentIndex,
//       20,
//       true,
//       whirlpoolData.getData().tickSpacing,
//     );
//     console.log("inited aToB ticks", initAtoB.length);

//     const initBToA = await WhirlpoolUtil.initTickArrayRange(
//       whirlpool,
//       whirlpoolData.getData().tickCurrentIndex,
//       20,
//       false,
//       whirlpoolData.getData().tickSpacing,
//     );
//     console.log("inited btoA ticks", initBToA.length);

//     const tickLowerIndex =
//       whirlpoolData.getData().tickCurrentIndex -
//       whirlpoolData.getData().tickSpacing * TICK_ARRAY_SIZE * 1;
//     const tickUpperIndex =
//       whirlpoolData.getData().tickCurrentIndex +
//       whirlpoolData.getData().tickSpacing * TICK_ARRAY_SIZE * 1;

//     const openPositionTxId = await toTx(
//       WhirlpoolUtil.whirlpoolCtx,
//       WhirlpoolIx.openPositionIx(WhirlpoolUtil.whirlpoolCtx.program, {
//         whirlpool,
//         owner: payerKeypair.publicKey,
//         positionPda,
//         positionMintAddress: positionMintKeypair.publicKey,
//         positionTokenAccount,
//         tickLowerIndex,
//         tickUpperIndex,
//         funder: payerKeypair.publicKey,
//       }),
//     )
//       .addSigner(positionMintKeypair)
//       .addSigner(payerKeypair)
//       .buildAndExecute();
//     console.log("openPositionTxId", openPositionTxId);
//     const position = await whirlpoolClient.getPosition(positionPda.publicKey);

//     const depositAAmount = await TokenUtil.scaleAmount(
//       amount(1, Denom.Thousand),
//       tokenB,
//     );
//     const increaseQuote = increaseLiquidityQuoteByInputToken(
//       whirlpoolData.getData().tokenMintB,
//       new Decimal("100000000"),
//       tickLowerIndex,
//       tickUpperIndex,
//       Percentage.fromFraction(100, 100),
//       whirlpoolData,
//     );
//     console.log(JSON.stringify(increaseQuote, undefined, 2));
//     const tx = await position.increaseLiquidity(
//       increaseQuote,
//       false,
//       payerKeypair.publicKey,
//       payerKeypair.publicKey,
//       payerKeypair.publicKey,
//     );
//     const increaseLiqudityTxId = await tx
//       .addSigner(payerKeypair)
//       .buildAndExecute();
//     console.log("increaseLiqudityTxId", increaseLiqudityTxId);
//   });

//   it("setup whirlpool", async () => {
//     true.should.be.true();
//   });
// }
