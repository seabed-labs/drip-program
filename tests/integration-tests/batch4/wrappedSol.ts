// import {
//   createAssociatedTokenAccountInstruction,
//   createCloseAccountInstruction,
//   createSyncNativeInstruction,
//   getAccount,
//   getAssociatedTokenAddress,
//   getMinimumBalanceForRentExemptAccount,
//   NATIVE_MINT,
// } from "@solana/spl-token";
// import { Keypair } from "@solana/web3.js";
// import should from "should";
// import { TestUtil } from "../../utils/config.util";
// import { ProgramUtil } from "../../utils/program.util";
// import { SolUtil } from "../../utils/sol.util";
// import { TransactionUtil } from "../../utils/transaction.util";

// describe("Wrapping and Unwrapping SOL", testWrappedSOL);

// export function testWrappedSOL() {
//   it("works ks expected", async () => {
//     const randomWallet = Keypair.generate();
//     await SolUtil.fundAccount(randomWallet.publicKey, SolUtil.solToLamports(2));

//     const randomWalletSOLBalanceBefore =
//       await TestUtil.provider.connection.getBalance(randomWallet.publicKey);

//     randomWalletSOLBalanceBefore.should.be.equal(SolUtil.solToLamports(2));

//     const rentExemptValue = await getMinimumBalanceForRentExemptAccount(
//       TestUtil.provider.connection
//     );

//     const randomWalletWsolAta = await getAssociatedTokenAddress(
//       NATIVE_MINT,
//       randomWallet.publicKey
//     );

//     let randomWalletWsolAtaAccountInfo =
//       await TestUtil.provider.connection.getAccountInfo(randomWalletWsolAta);

//     should(randomWalletWsolAtaAccountInfo).be.null();

//     const createAtaIx = createAssociatedTokenAccountInstruction(
//       randomWallet.publicKey,
//       randomWalletWsolAta,
//       randomWallet.publicKey,
//       NATIVE_MINT
//     );

//     const fundAtaIx = ProgramUtil.systemProgram.transfer({
//       fromPubkey: randomWallet.publicKey,
//       toPubkey: randomWalletWsolAta,
//       lamports: SolUtil.solToLamports(1),
//     });

//     const syncNativeIx = createSyncNativeInstruction(randomWalletWsolAta);

//     await TransactionUtil.executeInstructionsWithSigners(
//       [createAtaIx, fundAtaIx, syncNativeIx],
//       [randomWallet]
//     );

//     randomWalletWsolAtaAccountInfo =
//       await TestUtil.provider.connection.getAccountInfo(randomWalletWsolAta);

//     const randomWalletWsolAtaAccount = await getAccount(
//       TestUtil.provider.connection,
//       randomWalletWsolAta
//     );

//     const randomWalletSOLBalanceAfter =
//       await TestUtil.provider.connection.getBalance(randomWallet.publicKey);

//     SolUtil.lamportsToSol(randomWalletSOLBalanceBefore).should.equal(2);
//     SolUtil.lamportsToSol(rentExemptValue).should.equal(0.00203928);
//     SolUtil.lamportsToSol(randomWalletSOLBalanceAfter).should.equal(0.99796072); // 2 - (1 + rent-exempt-value)
//     SolUtil.lamportsToSol(randomWalletWsolAtaAccountInfo.lamports).should.equal(
//       1.00203928
//     ); // 1 + rent-exempt-value
//     SolUtil.lamportsToSol(
//       Number(randomWalletWsolAtaAccount.amount.toString())
//     ).should.equal(1);

//     const closeAtaIx = createCloseAccountInstruction(
//       randomWalletWsolAta,
//       randomWallet.publicKey,
//       randomWallet.publicKey
//     );

//     await TransactionUtil.executeInstructionsWithSigners(
//       [closeAtaIx],
//       [randomWallet]
//     );

//     randomWalletWsolAtaAccountInfo =
//       await TestUtil.provider.connection.getAccountInfo(randomWalletWsolAta);
//     const randomWalletSOLBalanceAfterClose =
//       await TestUtil.provider.connection.getBalance(randomWallet.publicKey);
//     SolUtil.lamportsToSol(randomWalletSOLBalanceAfterClose).should.equal(2);
//     should(randomWalletWsolAtaAccountInfo).be.null();
//   });
// }
