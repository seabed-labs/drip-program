import {
  amount,
  Denom,
  findAssociatedTokenAddress,
  generatePair,
  getPositionPDA,
  getVaultPeriodPDA,
  PDA,
} from "./common.util";
import { DripUtil } from "./drip.util";
import { Keypair, PublicKey } from "@solana/web3.js";
import { TokenUtil } from "./token.util";
import { SolUtil } from "./sol.util";
import { Token, u64 } from "@solana/spl-token";

export const sleep = async (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const deployVaultPeriod = async (
  vaultProtoConfig: PublicKey,
  vault: PublicKey,
  tokenAMint: PublicKey,
  tokenBMint: PublicKey,
  period: number
): Promise<PDA> => {
  const vaultPeriodPDA = await getVaultPeriodPDA(vault, period);
  await DripUtil.initVaultPeriod(
    vault,
    vaultPeriodPDA.publicKey,
    vaultProtoConfig,
    period
  );
  return vaultPeriodPDA;
};

export type DeployWithNewUserWrapper = ({
  numberOfCycles,
  newUserEndVaultPeriod,
  mintAmount,
}: {
  numberOfCycles: number;
  newUserEndVaultPeriod: PublicKey;
  mintAmount: number;
}) => Promise<void>;

export const depositWithNewUserWrapper = (
  vault: PublicKey,
  tokenOwnerKeypair: Keypair,
  tokenA: Token,
  referrer: PublicKey
): DeployWithNewUserWrapper => {
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
      user2TokenAAccount,
      referrer
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
  userTokenAAccount: PublicKey,
  referrer: PublicKey
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
  await DripUtil.deposit({
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

export type DripSPLTokenSwapWrapper = (
  prevPeriod: PublicKey,
  currPeriod: PublicKey
) => Promise<void>;

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
): DripSPLTokenSwapWrapper => {
  return async (
    previousDripPeriod: PublicKey,
    currentDripPeriod: PublicKey
  ): Promise<void> => {
    await DripUtil.dripSPLTokenSwap(
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

export type DripOrcaWhirlpoolWrapper = (
  prevPeriod: PublicKey,
  currPeriod: PublicKey,
  ta1: PublicKey,
  ta2: PublicKey,
  ta3: PublicKey
) => Promise<void>;

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
): DripOrcaWhirlpoolWrapper => {
  return async (
    lastVaultPeriod: PublicKey,
    currentVaultPeriod: PublicKey,
    tickArray0: PublicKey,
    tickArray1: PublicKey,
    tickArray2: PublicKey
  ): Promise<void> => {
    await DripUtil.dripOrcaWhirlpool({
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
  };
};

export type WithdrawBWrapper = (
  vaultPeriodI: PublicKey,
  vaultPeriodJ: PublicKey
) => Promise<string>;

export const withdrawBWrapper = (
  user: Keypair,
  vault: PublicKey,
  vaultProtoConfig: PublicKey,
  positionAccount: PublicKey,
  userPostionNFTAccount: PublicKey,
  vaultTokenB: PublicKey,
  vaultTreasuryTokenBAccount: PublicKey,
  userTokenBAccount: PublicKey,
  referrer?: PublicKey
): WithdrawBWrapper => {
  return async (vaultPeriodI: PublicKey, vaultPeriodJ: PublicKey) => {
    return await DripUtil.withdrawB(
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
      referrer
    );
  };
};

export type ClosePositionWrapper = (
  vaultPeriodI: PublicKey,
  vaultPeriodJ: PublicKey,
  vaultPeriodUserExpiry: PublicKey
) => Promise<string>;

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
): ClosePositionWrapper => {
  return async (
    vaultPeriodI: PublicKey,
    vaultPeriodJ: PublicKey,
    vaultPeriodUserExpiry: PublicKey
  ): Promise<string> => {
    return await DripUtil.closePosition(
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
