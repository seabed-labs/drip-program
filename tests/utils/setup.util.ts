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
import { VaultUtil } from "./Vault.util";
import { Keypair, PublicKey } from "@solana/web3.js";
import { TokenUtil } from "./Token.util";
import { SolUtils } from "./SolUtils";
import { SwapUtil } from "./Swap.util";
import { Token, u64 } from "@solana/spl-token";

export const sleep = async (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const deployVaultProtoConfig = async (
  granularity: number,
  triggerDCASpread: number,
  baseWithdrawalSpread: number
): Promise<PublicKey> => {
  const vaultProtoConfigKeypair = generatePair();
  await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
    granularity,
    triggerDCASpread,
    baseWithdrawalSpread,
  });
  return vaultProtoConfigKeypair.publicKey;
};

export const deployVault = async (
  tokenAMint: PublicKey,
  tokenBMint: PublicKey,
  vaultTreasuryTokenBAccount: PublicKey,
  vaultProtoConfigAccount: PublicKey
): Promise<PDA> => {
  const vaultPDA = await getVaultPDA(
    tokenAMint,
    tokenBMint,
    vaultProtoConfigAccount
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
    vaultTreasuryTokenBAccount
  );
  return vaultPDA;
};

export const deployVaultPeriod = async (
  vaultProtoConfig: PublicKey,
  vault: PublicKey,
  tokenAMint: PublicKey,
  tokenBMint: PublicKey,
  period: number
): Promise<PDA> => {
  const vaultPeriodPDA = await getVaultPeriodPDA(vault, period);

  const txHash = await VaultUtil.initVaultPeriod(
    vault,
    vaultPeriodPDA.publicKey,
    vaultProtoConfig,
    tokenAMint,
    tokenBMint,
    period
  );
  console.log("initVaultPeriod", txHash);
  return vaultPeriodPDA;
};

// TODO(Mocha): might be useful to return the new user
export const depositWithNewUserWrapper = (
  vault: PublicKey,
  tokenOwnerKeypair: Keypair,
  tokenA: Token,
  shouldLog: boolean = false
) => {
  return async ({
    dcaCycles,
    newUserEndVaultPeriod,
    mintAmount,
  }: {
    dcaCycles: number;
    newUserEndVaultPeriod: PublicKey;
    mintAmount: number;
  }) => {
    const user2 = generatePair();
    if (shouldLog) {
      console.log(
        "user2:",
        user2.publicKey.toBase58(),
        user2.secretKey.toString()
      );
    }
    await SolUtils.fundAccount(user2.publicKey, SolUtils.solToLamports(0.2));
    const user2TokenAAccount = await tokenA.createAssociatedTokenAccount(
      user2.publicKey
    );
    if (shouldLog) {
      console.log("user2TokenAAccount:", user2TokenAAccount.toBase58());
    }
    const user2MintAmount = await TokenUtil.scaleAmount(
      amount(mintAmount, Denom.Thousand),
      tokenA
    );
    await tokenA.mintTo(
      user2TokenAAccount,
      tokenOwnerKeypair,
      [],
      user2MintAmount
    );
    const [
      user2PositionNFTMint,
      user2PositionAccount,
      user2PositionNFTAccount,
    ] = await depositToVault(
      user2,
      tokenA,
      user2MintAmount,
      new u64(dcaCycles),
      vault,
      newUserEndVaultPeriod,
      user2TokenAAccount
    );
    if (shouldLog) {
      console.log("user2PositionNFTMint:", user2PositionNFTMint.toBase58());
      console.log("user2PositionAccount:", user2PositionAccount.toBase58());
      console.log(
        "user2PositionNFTAccount:",
        user2PositionNFTAccount.toBase58()
      );
    }
  };
};

export const depositToVault = async (
  user: Keypair,
  tokenA: Token,
  tokenADepositAmount: u64,
  dcaCycles: u64,
  vault: PublicKey,
  vaultPeriodEnd: PublicKey,
  userTokenAAccount: PublicKey
): Promise<PublicKey[]> => {
  await tokenA.approve(
    userTokenAAccount,
    vault,
    user.publicKey,
    [user],
    tokenADepositAmount
  );
  const userPositionNftMint = generatePair();
  const positionPDA = await getPositionPDA(userPositionNftMint.publicKey);
  const [vaultTokenAAccount, userPositionNftAccount] = await Promise.all([
    findAssociatedTokenAddress(vault, tokenA.publicKey),
    findAssociatedTokenAddress(user.publicKey, userPositionNftMint.publicKey),
  ]);
  await VaultUtil.deposit({
    params: {
      tokenADepositAmount,
      dcaCycles,
    },
    accounts: {
      vault,
      vaultPeriodEnd,
      userPosition: positionPDA.publicKey,
      tokenAMint: tokenA.publicKey,
      userPositionNftMint: userPositionNftMint.publicKey,
      vaultTokenAAccount,
      userTokenAAccount,
      userPositionNftAccount,
      depositor: user.publicKey,
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

export const deploySwap = async (
  tokenA: Token,
  tokenAMintOwner: Keypair,
  tokenB: Token,
  tokenBMintOwner: Keypair,
  payerKeypair: Keypair
): Promise<PublicKey[]> => {
  const [swapOwnerKeyPair, tokenSwapKeypair, swapPayerKeypair] =
    generatePairs(5);
  await SolUtils.fundAccount(
    swapPayerKeypair.publicKey,
    SolUtils.solToLamports(0.2)
  );
  await SolUtils.fundAccount(
    swapOwnerKeyPair.publicKey,
    SolUtils.solToLamports(0.2)
  );
  const swapAuthorityPDA = await getSwapAuthorityPDA(
    tokenSwapKeypair.publicKey
  );
  const swapLPToken = await TokenUtil.createMint(
    swapAuthorityPDA.publicKey,
    null,
    2,
    payerKeypair
  );
  const swapLPTokenAccount = await swapLPToken.createAccount(
    swapOwnerKeyPair.publicKey
  );
  const swapLPTokenFeeAccount = await swapLPToken.createAccount(
    new PublicKey("HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN")
  );
  const swapTokenAAccount = await tokenA.createAccount(
    swapAuthorityPDA.publicKey
  );
  const mintAmount = await TokenUtil.scaleAmount(
    amount(1, Denom.Million),
    tokenA
  );
  await tokenA.mintTo(swapTokenAAccount, tokenAMintOwner, [], mintAmount);
  const swapTokenBAccount = await tokenB.createAccount(
    swapAuthorityPDA.publicKey
  );
  await tokenB.mintTo(swapTokenBAccount, tokenBMintOwner, [], mintAmount);
  await SwapUtil.createSwap(
    swapPayerKeypair,
    tokenSwapKeypair,
    swapAuthorityPDA,
    tokenA.publicKey,
    tokenB.publicKey,
    swapTokenAAccount,
    swapTokenBAccount,
    swapLPToken.publicKey,
    swapLPTokenFeeAccount,
    swapLPTokenAccount
  );
  return [
    tokenSwapKeypair.publicKey,
    swapLPToken.publicKey,
    swapTokenAAccount,
    swapTokenBAccount,
    swapLPTokenFeeAccount,
    swapAuthorityPDA.publicKey,
  ];
};

export const triggerDCAWrapper = (
  user: Keypair,
  dcaTriggerFeeTokenAAccount: PublicKey,
  vault: PublicKey,
  vaultProtoConfig: PublicKey,
  vaultTokenA_ATA: PublicKey,
  vaultTokenB_ATA,
  tokenAMint: PublicKey,
  tokenBMint: PublicKey,
  swapTokenMint: PublicKey,
  swapTokenAAccount: PublicKey,
  swapTokenBAccount: PublicKey,
  swapFeeAccount: PublicKey,
  swapAuthority: PublicKey,
  swap: PublicKey
) => {
  return async (previousDCAPeriod: PublicKey, currentDCAPeriod: PublicKey) => {
    await VaultUtil.triggerDCA(
      user,
      dcaTriggerFeeTokenAAccount,
      vault,
      vaultProtoConfig,
      vaultTokenA_ATA,
      vaultTokenB_ATA,
      previousDCAPeriod,
      currentDCAPeriod,
      tokenAMint,
      tokenBMint,
      swapTokenMint,
      swapTokenAAccount,
      swapTokenBAccount,
      swapFeeAccount,
      swapAuthority,
      swap
    );
  };
};

export const withdrawBWrapper = (
  user: Keypair,
  vault: PublicKey,
  vaultProtoConfig: PublicKey,
  positionAccount: PublicKey,
  userPostionNFTAccount: PublicKey,
  userPositionNFTMint: PublicKey,
  vaultTokenA: PublicKey,
  vaultTokenB: PublicKey,
  vaultTreasuryTokenBAccount: PublicKey,
  tokenBMint: PublicKey,
  userTokenBAccount: PublicKey
) => {
  return async (vaultPeriodI: PublicKey, vaultPeriodJ: PublicKey) => {
    const txHash = await VaultUtil.withdrawB(
      user,
      vault,
      vaultProtoConfig,
      positionAccount,
      userPostionNFTAccount,
      userPositionNFTMint,
      vaultTokenA,
      vaultTokenB,
      vaultTreasuryTokenBAccount,
      vaultPeriodI,
      vaultPeriodJ,
      tokenBMint,
      userTokenBAccount
    );
    console.log("withdrawB", txHash);
  };
};

export const closePositionWrapper = (
  withdrawer: Keypair,
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
  tokenAMint: PublicKey,
  tokenBMint: PublicKey
) => {
  return async (
    vaultPeriodI: PublicKey,
    vaultPeriodJ: PublicKey,
    vaultPeriodUserExpiry: PublicKey
  ) => {
    const txHash = await VaultUtil.closePosition(
      withdrawer,
      vault,
      vaultProtoConfig,
      userPosition,
      vaultPeriodI,
      vaultPeriodJ,
      vaultPeriodUserExpiry,
      vaultTokenAAccount,
      vaultTokenBAccount,
      vaultTreasuryTokenBAccount,
      userTokenAAccount,
      userTokenBAccount,
      userPositionNftAccount,
      userPositionNftMint,
      tokenAMint,
      tokenBMint
    );
    console.log("closePosition", txHash);
  };
};
