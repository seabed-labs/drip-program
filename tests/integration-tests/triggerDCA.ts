import { SolUtils } from "../utils/SolUtils";
import { TokenUtil } from "../utils/Token.util";
import { generatePairs } from "../utils/common.util";
import { deploySwap } from "../utils/instruction.util";

export function testTriggerDCA() {
  beforeEach(async () => {
    // console.log("1. Generated 4 keypairs:", {
    //   payer: payerKeypair.publicKey.toBase58(),
    //   owner: ownerKeypair.publicKey.toBase58(),
    //   tokenSwap: tokenSwapKeypair.publicKey.toBase58(),
    //   swapPayer: swapPayerKeypair.publicKey.toBase58(),
    // });
    //

    // await SolUtils.fundAccount(swapPayerKeypair.publicKey, 1000000000);
    // console.log(
    //   "2. Funded owner, payer, and swapPayer with 1000000000 lamports"
    // );
    //
    // const swapAuthorityPDA = await getSwapAuthorityPDA(
    //   tokenSwapKeypair.publicKey
    // );
    // console.log(
    //   `3. Generated swap authority PDA for tokenSwap = ${tokenSwapKeypair.publicKey}:`,
    //   {
    //     swapAuthorityPDA: {
    //       publicKey: swapAuthorityPDA.publicKey.toBase58(),
    //       bump: swapAuthorityPDA.bump,
    //     },
    //   }
    // );
    //
    // const swapLPToken = await TokenUtil.createMint(
    //   swapAuthorityPDA.publicKey,
    //   null,
    //   2,
    //   payerKeypair
    // );
    // console.log("4. Created LP token mint for tokenSwap:", {
    //   mint: swapLPToken.publicKey.toBase58(),
    // });
    //
    // const swapLPTokenAccount = await swapLPToken.createAccount(
    //   ownerKeypair.publicKey
    // );
    // console.log("5. Created LP token account with owner as owner:", {
    //   account: swapLPTokenAccount.toBase58(),
    // });
    //
    // const swapLPTokenFeeAccount = await swapLPToken.createAccount(
    //   new PublicKey("HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN")
    // );
    // console.log("6. Created LP token fee account with owner as owner:", {
    //   account: swapLPTokenFeeAccount.toBase58(),
    // });
    //

    // console.log("7. Created Token A Mint:", {
    //   mint: tokenA.publicKey.toBase58(),
    // });
    //
    // const swapTokenAAccount = await tokenA.createAccount(
    //   swapAuthorityPDA.publicKey
    // );
    // console.log("8. Created Token A Account for swap:", {
    //   account: swapTokenAAccount.toBase58(),
    // });
    //
    // await tokenA.mintTo(swapTokenAAccount, ownerKeypair, [], 1000000);
    // console.log("9. Minted token A to swap account");
    //

    // console.log("10. Created Token B Mint:", {
    //   mint: tokenB.publicKey.toBase58(),
    // });
    //
    // const swapTokenBAccount = await tokenB.createAccount(
    //   swapAuthorityPDA.publicKey
    // );
    // console.log("11. Created Token B Account for swap:", {
    //   account: swapTokenBAccount.toBase58(),
    // });
    //
    // await tokenB.mintTo(swapTokenBAccount, ownerKeypair, [], 1000000);
    // console.log("12. Minted token B to swap account");
    //
    // const tokenSwap = await SwapUtil.createSwap(
    //   swapPayerKeypair,
    //   tokenSwapKeypair,
    //   swapAuthorityPDA,
    //   tokenA.publicKey,
    //   tokenB.publicKey,
    //   swapTokenAAccount,
    //   swapTokenBAccount,
    //   swapLPToken.publicKey,
    //   swapLPTokenFeeAccount,
    //   swapLPTokenAccount
    // );
    // console.log("13. Created swap account:", {
    //   address: tokenSwapKeypair.publicKey.toBase58(),
    // });
    //
    // const vaultProtoConfigKeypair = generatePair();
    // await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
    //   granularity: Granularity.HOURLY,
    // });
    // vaultProtoConfigAccount = vaultProtoConfigKeypair.publicKey;
    //
    // console.log("14. Created vault proto config account:", {
    //   address: vaultProtoConfigKeypair.publicKey.toBase58(),
    // });
    //
    // vaultPDA = await getVaultPDA(
    //   tokenA.publicKey,
    //   tokenB.publicKey,
    //   vaultProtoConfigKeypair.publicKey
    // );
    // const [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
    //   findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
    //   findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
    // ]);
    // console.log("15. Generated 2 vault token ATA's:", {
    //   vaultTokenA_ATA: vaultTokenA_ATA.toBase58(),
    //   vaultTokenB_ATA: vaultTokenB_ATA.toBase58(),
    // });
    const [tokenOwnerKeypair, payerKeypair] = generatePairs(2);
    await SolUtils.fundAccount(payerKeypair.publicKey, 1000000000);
    await SolUtils.fundAccount(tokenOwnerKeypair.publicKey, 1000000000);
    const tokenA = await TokenUtil.createMint(
      tokenOwnerKeypair.publicKey,
      null,
      2,
      payerKeypair
    );
    const tokenB = await TokenUtil.createMint(
      tokenOwnerKeypair.publicKey,
      null,
      2,
      payerKeypair
    );
    const swap = await deploySwap(
      tokenA,
      tokenOwnerKeypair,
      tokenB,
      tokenOwnerKeypair,
      payerKeypair
    );
  });

  it("sanity", () => {
    true.should.equal(true);
  });
}
