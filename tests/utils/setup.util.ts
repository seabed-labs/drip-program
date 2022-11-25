import {
  amount,
  Denom,
  findAssociatedTokenAddress,
  generatePair,
  getPositionPDA,
  getVaultPeriodPDA,
  PDA,
} from "./common.util";
import { DeployVaultRes, DripUtil } from "./drip.util";
import { Keypair, PublicKey } from "@solana/web3.js";
import { TokenUtil } from "./token.util";
import { SolUtil } from "./sol.util";
import { Token, u64 } from "@solana/spl-token";
import {
  AccountFetcher,
  buildWhirlpoolClient,
  swapQuoteByInputToken,
} from "@orca-so/whirlpools-sdk";
import { WhirlpoolUtil } from "./whirlpool.util";
import { Percentage } from "@orca-so/common-sdk";
import { ProgramUtil } from "./program.util";
import { AccountUtil } from "./account.util";
import { BN } from "@project-serum/anchor";

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

export type GenericDripWrapper = (
  deployVaultRes: DeployVaultRes,
  prevPeriod: PublicKey,
  currPeriod: PublicKey
) => Promise<void>;

export const dripSPLTokenSwapWrapper = (
  swapTokenMint: PublicKey,
  swapTokenAAccount: PublicKey,
  swapTokenBAccount: PublicKey,
  swapFeeAccount: PublicKey,
  swapAuthority: PublicKey,
  swap: PublicKey
): GenericDripWrapper => {
  return async (
    deployVaultRes: DeployVaultRes,
    previousDripPeriod: PublicKey,
    currentDripPeriod: PublicKey
  ): Promise<void> => {
    await DripUtil.dripSPLTokenSwap(
      deployVaultRes.botKeypair,
      deployVaultRes.botTokenAAcount,
      deployVaultRes.vault,
      deployVaultRes.vaultProtoConfig,
      deployVaultRes.vaultTokenAAccount,
      deployVaultRes.vaultTokenBAccount,
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

export const dripOrcaWhirlpoolWrapper = async (
  swapTokenAAccount: PublicKey,
  swapTokenBAccount: PublicKey,
  whirlpool: PublicKey,
  oracle: PublicKey
): Promise<GenericDripWrapper> => {
  const whirlpoolClient = buildWhirlpoolClient(WhirlpoolUtil.whirlpoolCtx);
  const fetcher = new AccountFetcher(WhirlpoolUtil.provider.connection);
  const whirlpoolAccount = await whirlpoolClient.getPool(whirlpool, false);
  return async (
    deployVaultRes: DeployVaultRes,
    lastVaultPeriod: PublicKey,
    currentVaultPeriod: PublicKey
  ): Promise<void> => {
    const vaultAccount = await AccountUtil.fetchVaultAccount(
      deployVaultRes.vault
    );
    const dripAmount = vaultAccount.dripAmount.toNumber();
    const tokenAmount = dripAmount <= 0 ? 1 : dripAmount;
    const quote = await swapQuoteByInputToken(
      whirlpoolAccount,
      deployVaultRes.tokenAMint.publicKey,
      new BN(tokenAmount),
      Percentage.fromFraction(10, 100),
      ProgramUtil.orcaWhirlpoolProgram.programId,
      fetcher,
      true
    );
    await DripUtil.dripOrcaWhirlpool({
      botKeypair: deployVaultRes.botKeypair,
      dripFeeTokenAAccount: deployVaultRes.botTokenAAcount,
      vault: deployVaultRes.vault,
      vaultProtoConfig: deployVaultRes.vaultProtoConfig,
      vaultTokenAAccount: deployVaultRes.vaultTokenAAccount,
      vaultTokenBAccount: deployVaultRes.vaultTokenBAccount,
      lastVaultPeriod,
      currentVaultPeriod,
      swapTokenAAccount,
      swapTokenBAccount,
      whirlpool,
      tickArray0: quote.tickArray0,
      tickArray1: quote.tickArray1,
      tickArray2: quote.tickArray2,
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
