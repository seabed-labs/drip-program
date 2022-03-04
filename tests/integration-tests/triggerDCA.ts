import {Keypair, PublicKey, Signer} from "@solana/web3.js";
import {Token} from "@solana/spl-token";
import {KeypairUtils} from "../utils/KeypairUtils";
import {SolUtils} from "../utils/SolUtils";
import {DECIMALS, TokenUtils} from "../utils/TokenUtils";
import {amount, Denom} from "../utils/amount";
import {VaultUtils} from "../utils/VaultUtils";
import {Granularity} from "../utils/Granularity";
import {PDA, PDAUtils} from "../utils/PDAUtils";
import {SwapUtils} from "../utils/SwapUtils";

export function testTriggerDCA() {
  let vaultProtoConfigPubkey: PublicKey;
  let vaultPubkey: PublicKey;
  let vaultPeriodPubkey: PublicKey;
  let usdcMinter: Signer, btcMinter: Signer, user: Signer, swapHost: Keypair;
  let usdc: Token, btc: Token;
  let vaultTokenA_ATA: PublicKey, vaultTokenB_ATA: PublicKey;
  let userBTC_ATA: PublicKey, userUSDC_ATA: PublicKey;

  function tokenA(): Token {
    return usdc;
  }

  function tokenB(): Token {
    return btc;
  }

  function tokenAMint(): PublicKey {
    return usdc.publicKey;
  }

  function tokenBMint(): PublicKey {
    return btc.publicKey;
  }

  function userTokenA_ATA(): PublicKey {
    return userUSDC_ATA;
  }

  function userTokenB_ATA(): PublicKey {
    return userBTC_ATA;
  }

  beforeEach(async () => {
    [usdcMinter, btcMinter, user, swapHost] = KeypairUtils.generatePairs(4);
    await SolUtils.fundAccount(user.publicKey, SolUtils.solToLamports(10));
    await SolUtils.fundAccount(swapHost.publicKey, SolUtils.solToLamports(10));

    [usdc, btc] = await TokenUtils.createMints(
      [usdcMinter.publicKey, btcMinter.publicKey],
      [DECIMALS.USDC, DECIMALS.BTC]
    );

    const [usdcAmount, btcAmount] = await TokenUtils.scaleAmountBatch(
      [amount(10, Denom.Million), usdc],
      [amount(1, Denom.Thousand), btc]
    );

    [userUSDC_ATA, userBTC_ATA] = await TokenUtils.mintToBatch([
      {
        token: usdc,
        mintAuthority: usdcMinter,
        recipient: user.publicKey,
        amount: usdcAmount,
      },
      {
        token: btc,
        mintAuthority: btcMinter,
        recipient: user.publicKey,
        amount: btcAmount,
      },
    ]);

    const vaultProtoConfigKeypair = KeypairUtils.generatePair();
    await VaultUtils.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.DAILY,
    });
    vaultProtoConfigPubkey = vaultProtoConfigKeypair.publicKey;

    const vaultPDA = await PDAUtils.getVaultPDA(
      tokenAMint(),
      tokenBMint(),
      vaultProtoConfigPubkey
    );

    [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      PDAUtils.findAssociatedTokenAddress(vaultPDA.publicKey, tokenAMint()),
      PDAUtils.findAssociatedTokenAddress(vaultPDA.publicKey, tokenBMint()),
    ]);

    await VaultUtils.initVault(
      vaultPDA.publicKey,
      vaultProtoConfigPubkey,
      tokenAMint(),
      tokenBMint(),
      vaultTokenA_ATA,
      vaultTokenB_ATA
    );

    vaultPubkey = vaultPDA.publicKey;

    const vaultPeriodPDA = await PDAUtils.getVaultPeriodPDA(vaultPubkey, 69);

    await VaultUtils.initVaultPeriod(
      vaultPubkey,
      vaultPeriodPDA.publicKey,
      vaultProtoConfigPubkey,
      tokenAMint(),
      tokenBMint(),
      69
    );

    vaultPeriodPubkey = vaultPeriodPDA.publicKey;

    const tokenSwapKeypair = await KeypairUtils.generatePair();
    const swapAuthorityPDA = await PDAUtils.getSwapAuthorityPDA(tokenSwapKeypair.publicKey);
    const swapTokenAAccount = await TokenUtils.createTokenAccount(tokenA(), swapAuthorityPDA.publicKey);
    const swapTokenBAccount = await TokenUtils.createTokenAccount(tokenB(), swapAuthorityPDA.publicKey);
    const poolToken = await TokenUtils.createMint(swapAuthorityPDA.publicKey, null, 6);
    const poolTokenFeeAccount = await TokenUtils.createTokenAccount(poolToken, swapAuthorityPDA.publicKey);
    const swapPoolTokenAccount = await TokenUtils.createTokenAccount(poolToken, swapAuthorityPDA.publicKey);

    // await SolUtils.fundAccount(tokenSwapKeypair.publicKey, SolUtils.solToLamports(10));
    await TokenUtils.mintTo({
      token: tokenA(),
      mintAuthority: usdcMinter,
      recipient: swapTokenAAccount,
      amount: usdcAmount,
    });

    await TokenUtils.mintTo({
      token: tokenB(),
      mintAuthority: btcMinter,
      recipient: swapTokenBAccount,
      amount: btcAmount,
    });

    const usdcBtcSwap = await SwapUtils.createSwap(
      swapHost,
      tokenSwapKeypair,
      swapAuthorityPDA,
      tokenAMint(),
      tokenBMint(),
      swapTokenAAccount,
      swapTokenBAccount,
      poolToken.publicKey,
      poolTokenFeeAccount,
      swapPoolTokenAccount,
    );

    console.log('USDC <> BTC Swap Account Info:', usdcBtcSwap);
  });

  it('sanity', () => {
    true.should.equal(true);
  });
}