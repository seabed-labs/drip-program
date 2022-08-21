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
import { Token, u64 } from "@solana/spl-token";

export const sleep = async (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const deployVaultProtoConfig = async (
  granularity: number,
  tokenADripTriggerSpread: number,
  tokenBWithdrawalSpread: number,
  admin: PublicKey
): Promise<PublicKey> => {
  const vaultProtoConfigKeypair = generatePair();
  await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
    granularity,
    tokenADripTriggerSpread,
    tokenBWithdrawalSpread,
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
  whitelistedSwaps?: PublicKey[]
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
    vaultTreasuryTokenBAccount,
    {
      whitelistedSwaps,
      maxSlippageBps: 1000,
    }
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
  await VaultUtil.initVaultPeriod(
    vault,
    vaultPeriodPDA.publicKey,
    vaultProtoConfig,
    tokenAMint,
    tokenBMint,
    period
  );
  return vaultPeriodPDA;
};

// TODO(Mocha): might be useful to return the new user
export const depositWithNewUserWrapper = (
  vault: PublicKey,
  tokenOwnerKeypair: Keypair,
  tokenA: Token
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
    const user2TokenAAccount = await tokenA.createAssociatedTokenAccount(
      user2.publicKey
    );
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
    await depositToVault(
      user2,
      tokenA,
      user2MintAmount,
      new u64(numberOfCycles),
      vault,
      newUserEndVaultPeriod,
      user2TokenAAccount
    );
  };
};

export const depositToVault = async (
  user: Keypair,
  tokenA: Token,
  tokenADepositAmount: u64,
  numberOfSwaps: u64,
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
      numberOfSwaps,
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
  tokenA: Token,
  tokenAMintOwner: Keypair,
  tokenB: Token,
  tokenBMintOwner: Keypair,
  payerKeypair: Keypair,
  mintAmount?: {
    a?: number;
    b?: number;
  }
): Promise<PublicKey[]> => {
  const [swapOwnerKeyPair, tokenSwapKeypair, swapPayerKeypair] =
    generatePairs(5);
  await SolUtil.fundAccount(
    swapPayerKeypair.publicKey,
    SolUtil.solToLamports(0.2)
  );
  await SolUtil.fundAccount(
    swapOwnerKeyPair.publicKey,
    SolUtil.solToLamports(0.2)
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
  const mintAmountA = await TokenUtil.scaleAmount(
    amount(mintAmount?.a ?? 1, Denom.Million),
    tokenA
  );
  await tokenA.mintTo(swapTokenAAccount, tokenAMintOwner, [], mintAmountA);
  const swapTokenBAccount = await tokenB.createAccount(
    swapAuthorityPDA.publicKey
  );
  const mintAmountB = await TokenUtil.scaleAmount(
    amount(mintAmount?.b ?? 1, Denom.Million),
    tokenB
  );
  await tokenB.mintTo(swapTokenBAccount, tokenBMintOwner, [], mintAmountB);
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
  swap: PublicKey
) => {
  return async (
    previousDripPeriod: PublicKey,
    currentDripPeriod: PublicKey
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
      swap
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
  oracle: PublicKey
) => {
  return async (
    lastVaultPeriod: PublicKey,
    currentVaultPeriod: PublicKey,
    tickArray0: PublicKey,
    tickArray1: PublicKey,
    tickArray2: PublicKey
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
  userPositionNFTMint: PublicKey,
  vaultTokenB: PublicKey,
  vaultTreasuryTokenBAccount: PublicKey,
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
      vaultTokenB,
      vaultTreasuryTokenBAccount,
      vaultPeriodI,
      vaultPeriodJ,
      userTokenBAccount
    );
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
  userPositionNftMint: PublicKey
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
      userPositionNftMint
    );
  };
};
