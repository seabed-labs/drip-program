import {
  amount,
  Denom,
  findAssociatedTokenAddress,
  generatePair,
  generatePairs,
  getPositionPDA,
  getSwapAuthorityPDA,
  getVaultPDA,
  getVaultPeriodPDA,
  PDA,
} from "./common.util";
import { VaultUtil } from "./vault.util";
import { Keypair, PublicKey } from "@solana/web3.js";
import { TokenUtil } from "./token.util";
import { SolUtil } from "./sol.util";
import { SwapUtil } from "./swap.util";
import { Mint } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";

export const sleep = async (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const deployVaultProtoConfig = async (
  granularity: number,
  tokenADripTriggerSpread: number,
  tokenBWithdrawalSpread: number,
  tokenBReferralSpread: number,
  admin: PublicKey,
): Promise<PublicKey> => {
  const vaultProtoConfigKeypair = generatePair();
  await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
    granularity,
    tokenADripTriggerSpread,
    tokenBWithdrawalSpread,
    tokenBReferralSpread,
    admin,
  });
  return vaultProtoConfigKeypair.publicKey;
};

/**
 * @deprecated Use VaultUtil.deployVault
 */
export const deployVault = async (
  tokenAMint: PublicKey,
  tokenBMint: PublicKey,
  vaultTreasuryTokenBAccount: PublicKey,
  vaultProtoConfigAccount: PublicKey,
  whitelistedSwaps?: PublicKey[],
  adminKeypair?: Keypair,
): Promise<PDA> => {
  const vaultPDA = await getVaultPDA(
    tokenAMint,
    tokenBMint,
    vaultProtoConfigAccount,
  );
  const [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
    findAssociatedTokenAddress(vaultPDA.publicKey, tokenAMint),
    findAssociatedTokenAddress(vaultPDA.publicKey, tokenBMint),
  ]);
  await VaultUtil.initVault(
    vaultPDA.publicKey,
    vaultProtoConfigAccount,
    tokenAMint,
    tokenBMint,
    vaultTokenA_ATA,
    vaultTokenB_ATA,
    vaultTreasuryTokenBAccount,
    {
      whitelistedSwaps,
      maxSlippageBps: 1000,
    },
    undefined,
    adminKeypair,
  );
  return vaultPDA;
};

export const deployVaultPeriod = async (
  vaultProtoConfig: PublicKey,
  vault: PublicKey,
  tokenAMint: PublicKey,
  tokenBMint: PublicKey,
  period: number,
): Promise<PDA> => {
  const vaultPeriodPDA = await getVaultPeriodPDA(vault, period);
  await VaultUtil.initVaultPeriod(
    vault,
    vaultPeriodPDA.publicKey,
    vaultProtoConfig,
    period,
  );
  return vaultPeriodPDA;
};

// TODO(Mocha): might be useful to return the new user
export const depositWithNewUserWrapper = (
  vault: PublicKey,
  tokenOwnerKeypair: Keypair,
  tokenA: Mint,
  referrer: PublicKey,
) => {
  return async ({
    numberOfCycles,
    newUserEndVaultPeriod,
    mintAmount,
  }: {
    numberOfCycles: number;
    newUserEndVaultPeriod: PublicKey;
    mintAmount: number;
  }) => {
    const user2 = generatePair();
    await SolUtil.fundAccount(user2.publicKey, SolUtil.solToLamports(0.2));
    const user2TokenAAccount =
      await TokenUtil.getOrCreateAssociatedTokenAccount(
        tokenA,
        user2.publicKey,
        user2,
      );
    const user2MintAmount = await TokenUtil.scaleAmount(
      amount(mintAmount, Denom.Thousand),
      tokenA,
    );

    await TokenUtil.mintTo({
      payer: user2,
      token: tokenA,
      mintAuthority: tokenOwnerKeypair,
      recipient: user2TokenAAccount,
      amount: user2MintAmount,
    });
    await depositToVault(
      user2,
      tokenA,
      user2MintAmount,
      BigInt(numberOfCycles),
      vault,
      newUserEndVaultPeriod,
      user2TokenAAccount,
      referrer,
    );
  };
};

export const depositToVault = async (
  user: Keypair,
  tokenA: Mint,
  tokenADepositAmount: bigint,
  numberOfSwaps: bigint,
  vault: PublicKey,
  vaultPeriodEnd: PublicKey,
  userTokenAAccount: PublicKey,
  referrer: PublicKey,
): Promise<PublicKey[]> => {
  const userPositionNftMint = generatePair();
  const positionPDA = await getPositionPDA(userPositionNftMint.publicKey);
  const [vaultTokenAAccount, userPositionNftAccount] = await Promise.all([
    findAssociatedTokenAddress(vault, tokenA.address),
    findAssociatedTokenAddress(user.publicKey, userPositionNftMint.publicKey),
  ]);
  await VaultUtil.deposit({
    params: {
      tokenADepositAmount: new BN(tokenADepositAmount),
      numberOfSwaps: new BN(numberOfSwaps),
    },
    accounts: {
      vault,
      vaultPeriodEnd,
      userPosition: positionPDA.publicKey,
      userPositionNftMint: userPositionNftMint.publicKey,
      vaultTokenAAccount,
      userTokenAAccount,
      userPositionNftAccount,
      depositor: user.publicKey,
      referrer,
    },
    signers: {
      depositor: user,
      userPositionNftMint,
    },
  });

  return [
    userPositionNftMint.publicKey,
    positionPDA.publicKey,
    userPositionNftAccount,
  ];
};

export const deploySPLTokenSwap = async (
  tokenA: Mint,
  tokenAMintOwner: Keypair,
  tokenB: Mint,
  tokenBMintOwner: Keypair,
  payerKeypair: Keypair,
  mintAmount?: {
    a?: bigint;
    b?: bigint;
  },
): Promise<PublicKey[]> => {
  const [swapOwnerKeyPair, tokenSwapKeypair, swapPayerKeypair] =
    generatePairs(5);
  await SolUtil.fundAccount(
    swapPayerKeypair.publicKey,
    SolUtil.solToLamports(0.2),
  );
  await SolUtil.fundAccount(
    swapOwnerKeyPair.publicKey,
    SolUtil.solToLamports(0.2),
  );
  const swapAuthorityPDA = await getSwapAuthorityPDA(
    tokenSwapKeypair.publicKey,
  );
  const swapLPToken = await TokenUtil.createMint(
    swapAuthorityPDA.publicKey,
    null,
    2,
    payerKeypair,
  );

  const swapLPTokenAccount = await TokenUtil.createTokenAccount(
    swapLPToken,
    swapOwnerKeyPair.publicKey,
    swapOwnerKeyPair,
  );
  const swapLPTokenFeeAccount = await TokenUtil.createTokenAccount(
    swapLPToken,
    new PublicKey("HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN"),
    swapOwnerKeyPair,
  );

  const swapTokenAAccount = await TokenUtil.createTokenAccount(
    tokenA,
    swapAuthorityPDA.publicKey,
    swapOwnerKeyPair,
  );
  const mintAmountA = TokenUtil.scaleAmount(
    amount(mintAmount?.a ?? 1, Denom.Million),
    tokenA,
  );
  await TokenUtil.mintTo({
    payer: swapOwnerKeyPair,
    token: tokenA,
    mintAuthority: tokenAMintOwner,
    recipient: swapTokenAAccount,
    amount: mintAmountA,
  });

  const swapTokenBAccount = await TokenUtil.createTokenAccount(
    tokenB,
    swapAuthorityPDA.publicKey,
    swapOwnerKeyPair,
  );
  const mintAmountB = TokenUtil.scaleAmount(
    amount(mintAmount?.b ?? 1, Denom.Million),
    tokenB,
  );
  await TokenUtil.mintTo({
    payer: swapOwnerKeyPair,
    token: tokenB,
    mintAuthority: tokenBMintOwner,
    recipient: swapTokenBAccount,
    amount: mintAmountB,
  });
  await SwapUtil.createSwap(
    swapPayerKeypair,
    tokenSwapKeypair,
    swapAuthorityPDA,
    tokenA.address,
    tokenB.address,
    swapTokenAAccount,
    swapTokenBAccount,
    swapLPToken.address,
    swapLPTokenFeeAccount,
    swapLPTokenAccount,
  );
  return [
    tokenSwapKeypair.publicKey,
    swapLPToken.address,
    swapTokenAAccount,
    swapTokenBAccount,
    swapLPTokenFeeAccount,
    swapAuthorityPDA.publicKey,
  ];
};

export const dripSPLTokenSwapWrapper = (
  user: Keypair,
  dripFeeTokenAAccount: PublicKey,
  vault: PublicKey,
  vaultProtoConfig: PublicKey,
  vaultTokenA_ATA: PublicKey,
  vaultTokenB_ATA,
  swapTokenMint: PublicKey,
  swapTokenAAccount: PublicKey,
  swapTokenBAccount: PublicKey,
  swapFeeAccount: PublicKey,
  swapAuthority: PublicKey,
  swap: PublicKey,
) => {
  return async (
    previousDripPeriod: PublicKey,
    currentDripPeriod: PublicKey,
  ) => {
    await VaultUtil.dripSPLTokenSwap(
      user,
      dripFeeTokenAAccount,
      vault,
      vaultProtoConfig,
      vaultTokenA_ATA,
      vaultTokenB_ATA,
      previousDripPeriod,
      currentDripPeriod,
      swapTokenMint,
      swapTokenAAccount,
      swapTokenBAccount,
      swapFeeAccount,
      swapAuthority,
      swap,
    );
  };
};

export const dripOrcaWhirlpoolWrapper = (
  botKeypair: Keypair,
  dripFeeTokenAAccount: PublicKey,
  vault: PublicKey,
  vaultProtoConfig: PublicKey,
  vaultTokenAAccount: PublicKey,
  vaultTokenBAccount: PublicKey,
  swapTokenAAccount: PublicKey,
  swapTokenBAccount: PublicKey,
  whirlpool: PublicKey,
  oracle: PublicKey,
) => {
  return async (
    lastVaultPeriod: PublicKey,
    currentVaultPeriod: PublicKey,
    tickArray0: PublicKey,
    tickArray1: PublicKey,
    tickArray2: PublicKey,
  ) => {
    try {
      await VaultUtil.dripOrcaWhirlpool({
        botKeypair,
        dripFeeTokenAAccount,
        vault,
        vaultProtoConfig,
        vaultTokenAAccount,
        vaultTokenBAccount,
        lastVaultPeriod,
        currentVaultPeriod,
        swapTokenAAccount,
        swapTokenBAccount,
        whirlpool,
        tickArray0,
        tickArray1,
        tickArray2,
        oracle,
      });
    } catch (e) {
      console.log(e);
    }
  };
};

export const withdrawBWrapper = (
  user: Keypair,
  vault: PublicKey,
  vaultProtoConfig: PublicKey,
  positionAccount: PublicKey,
  userPostionNFTAccount: PublicKey,
  vaultTokenB: PublicKey,
  vaultTreasuryTokenBAccount: PublicKey,
  userTokenBAccount: PublicKey,
  referrer?: PublicKey,
) => {
  return async (vaultPeriodI: PublicKey, vaultPeriodJ: PublicKey) => {
    const txHash = await VaultUtil.withdrawB(
      user,
      vault,
      vaultProtoConfig,
      positionAccount,
      userPostionNFTAccount,
      vaultTokenB,
      vaultTreasuryTokenBAccount,
      vaultPeriodI,
      vaultPeriodJ,
      userTokenBAccount,
      referrer,
    );
  };
};

export const closePositionWrapper = (
  nftOwner: Keypair,
  vault: PublicKey,
  vaultProtoConfig: PublicKey,
  userPosition: PublicKey,
  vaultTokenAAccount: PublicKey,
  vaultTokenBAccount: PublicKey,
  vaultTreasuryTokenBAccount: PublicKey,
  userTokenAAccount: PublicKey,
  userTokenBAccount: PublicKey,
  userPositionNftAccount: PublicKey,
  userPositionNftMint: PublicKey,
) => {
  return async (
    vaultPeriodI: PublicKey,
    vaultPeriodJ: PublicKey,
    vaultPeriodUserExpiry: PublicKey,
    overrides?: {
      nftOwner?: Keypair;
      vault?: PublicKey;
      vaultProtoConfig?: PublicKey;
      userPosition?: PublicKey;
      vaultTokenAAccount?: PublicKey;
      vaultTokenBAccount?: PublicKey;
      vaultTreasuryTokenBAccount?: PublicKey;
      userTokenAAccount?: PublicKey;
      userTokenBAccount?: PublicKey;
      userPositionNftAccount?: PublicKey;
      userPositionNftMint?: PublicKey;
      referrer?: PublicKey;
      solDestination?: PublicKey;
    },
  ) => {
    const txHash = await VaultUtil.closePosition(
      overrides?.nftOwner ?? nftOwner,
      overrides?.vault ?? vault,
      overrides?.vaultProtoConfig ?? vaultProtoConfig,
      overrides?.userPosition ?? userPosition,
      vaultPeriodI,
      vaultPeriodJ,
      vaultPeriodUserExpiry,
      overrides?.vaultTokenAAccount ?? vaultTokenAAccount,
      overrides?.vaultTokenBAccount ?? vaultTokenBAccount,
      overrides?.vaultTreasuryTokenBAccount ?? vaultTreasuryTokenBAccount,
      overrides?.userTokenAAccount ?? userTokenAAccount,
      overrides?.userTokenBAccount ?? userTokenBAccount,
      overrides?.userPositionNftAccount ?? userPositionNftAccount,
      overrides?.userPositionNftMint ?? userPositionNftMint,
      overrides?.referrer,
      overrides?.solDestination,
    );
  };
};
