import { TestUtil } from "./config.util";
import { ProgramUtil } from "./program.util";
import {
  Keypair,
  PublicKey,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import { Token, u64 } from "@solana/spl-token";
import {
  amount,
  Denom,
  findAssociatedTokenAddress,
  generatePair,
  getVaultPDA,
  Granularity,
  PDA,
} from "./common.util";
import { BN } from "@project-serum/anchor";
import { TokenUtil } from "./token.util";
import { deployVaultPeriod, depositToVault } from "./setup.util";
import { SolUtil } from "./sol.util";
import { Key } from "@metaplex-foundation/mpl-token-metadata";

export type VaultProtoConfigParams = {
  granularity: Granularity;
  tokenADripTriggerSpread: number;
  tokenBWithdrawalSpread: number;
  tokenBReferralSpread: number;
  admin: PublicKey;
};

export interface DepositTxParams {
  accounts: {
    vault: PublicKey;
    vaultPeriodEnd: PublicKey;
    userPosition: PublicKey;
    userPositionNftMint: PublicKey;
    vaultTokenAAccount: PublicKey;
    userTokenAAccount: PublicKey;
    userPositionNftAccount: PublicKey;
    depositor: PublicKey;
    referrer: PublicKey;
  };
  signers: {
    depositor: Signer;
    userPositionNftMint: Signer;
  };
  params: {
    tokenADepositAmount: u64;
    numberOfSwaps: u64;
  };
}

export interface DepositWithMetadataTxParams {
  accounts: {
    vault: PublicKey;
    vaultPeriodEnd: PublicKey;
    userPosition: PublicKey;
    userPositionNftMint: PublicKey;
    vaultTokenAAccount: PublicKey;
    userTokenAAccount: PublicKey;
    userPositionNftAccount: PublicKey;
    positionMetadataAccount: PublicKey;
    depositor: PublicKey;
    referrer: PublicKey;
  };
  signers: {
    depositor: Signer;
    userPositionNftMint: Signer;
  };
  params: {
    tokenADepositAmount: u64;
    numberOfSwaps: u64;
  };
}

export type DeployVaultRes = {
  vault: PublicKey;
  vaultProtoConfig: PublicKey;
  vaultPeriods: PublicKey[];
  userTokenAAccount: PublicKey;
  botKeypair: Keypair;
  botTokenAAcount: PublicKey;
  vaultTreasuryTokenBAccount: PublicKey;
  vaultTokenAAccount: PublicKey;
  vaultTokenBAccount: PublicKey;
  tokenAMint: Token;
  tokenBMint: Token;
  admin: Keypair;
};

// TODO(Mocha): Replace the program interaction with the SDK
export class DripUtil extends TestUtil {
  static async initVaultProtoConfig(
    vaultProtoConfigKeypair: Signer,
    vaultProtoConfig: VaultProtoConfigParams
  ): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .initVaultProtoConfig({
        granularity: new BN(vaultProtoConfig.granularity.toString()),
        tokenADripTriggerSpread: vaultProtoConfig.tokenADripTriggerSpread,
        tokenBWithdrawalSpread: vaultProtoConfig.tokenBWithdrawalSpread,
        tokenBReferralSpread: vaultProtoConfig.tokenBReferralSpread,
        admin: vaultProtoConfig.admin,
      })
      .accounts({
        vaultProtoConfig: vaultProtoConfigKeypair.publicKey,
        creator: this.provider.wallet.publicKey,
        systemProgram: ProgramUtil.systemProgram.programId,
      })
      .transaction();
    return await this.provider.sendAndConfirm(tx, [vaultProtoConfigKeypair]);
  }

  static async initVault(
    accounts: {
      vaultPubkey: PublicKey;
      vaultProtoConfigAccount: PublicKey;
      tokenAMint: PublicKey;
      tokenBMint: PublicKey;
      tokenAAccount: PublicKey;
      tokenBAccount: PublicKey;
      treasuryTokenBAccount: PublicKey;
    },
    params?: {
      whitelistedSwaps?: PublicKey[];
      maxSlippageBps?: number;
    },
    programs?: {
      systemProgram?: PublicKey;
      tokenProgram?: PublicKey;
      associatedTokenProgram?: PublicKey;
      rent?: PublicKey;
    },
    admin?: Keypair | Signer
  ): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .initVault({
        whitelistedSwaps: params?.whitelistedSwaps ?? [],
        maxSlippageBps: params?.maxSlippageBps ?? 1000,
      })
      .accounts({
        vault: accounts.vaultPubkey.toBase58(),
        vaultProtoConfig: accounts.vaultProtoConfigAccount.toBase58(),
        tokenAMint: accounts.tokenAMint.toBase58(),
        tokenBMint: accounts.tokenBMint.toBase58(),
        tokenAAccount: accounts.tokenAAccount.toBase58(),
        tokenBAccount: accounts.tokenBAccount.toBase58(),
        treasuryTokenBAccount: accounts.treasuryTokenBAccount.toBase58(),
        creator: admin?.publicKey ?? this.provider.wallet.publicKey.toBase58(),
        systemProgram:
          programs?.systemProgram?.toBase58() ??
          ProgramUtil.systemProgram.programId.toBase58(),
        tokenProgram:
          programs?.tokenProgram?.toBase58() ??
          ProgramUtil.tokenProgram.programId.toBase58(),
        associatedTokenProgram:
          programs?.associatedTokenProgram?.toBase58() ??
          ProgramUtil.associatedTokenProgram.programId.toBase58(),
        rent:
          programs?.rent?.toBase58() ??
          ProgramUtil.rentProgram.programId.toBase58(),
      })
      .transaction();
    if (admin) {
      const blockhash = await TestUtil.provider.connection.getLatestBlockhash();
      const txId = await TestUtil.provider.connection.sendTransaction(tx, [
        admin,
      ]);
      await TestUtil.provider.connection.confirmTransaction(
        {
          signature: txId,
          ...blockhash,
        },
        "confirmed"
      );
      return txId;
    } else {
      return await this.provider.sendAndConfirm(tx, undefined);
    }
  }

  static async setVaultSwapWhitelist(
    vaultPubkey: PublicKey,
    vaultProtoConfigPubkey: PublicKey,
    admin?: Keypair,
    params: {
      whitelistedSwaps: PublicKey[] | null | undefined;
    } = {
      whitelistedSwaps: undefined,
    }
  ): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .setVaultSwapWhitelist({
        whitelistedSwaps: params.whitelistedSwaps ?? [],
      })
      .accounts({
        vault: vaultPubkey.toBase58(),
        vaultProtoConfig: vaultProtoConfigPubkey.toBase58(),
        admin:
          admin?.publicKey.toBase58() ??
          this.provider.wallet.publicKey.toBase58(),
      })
      .transaction();
    if (admin) {
      const blockhash = await TestUtil.provider.connection.getLatestBlockhash();
      const txId = await TestUtil.provider.connection.sendTransaction(tx, [
        admin,
      ]);
      await TestUtil.provider.connection.confirmTransaction(
        {
          signature: txId,
          ...blockhash,
        },
        "confirmed"
      );
      return txId;
    } else {
      return await this.provider.sendAndConfirm(tx, undefined);
    }
  }

  static async setVaultOracleConfig(
    accounts: {
      admin?: Keypair | Signer;
      vault: PublicKey;
      vaultProtoConfig: PublicKey;
    },
    params: {
      oracleConfig: PublicKey;
    }
  ): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .setVaultOracleConfig({ ...params })
      .accounts({
        ...accounts,
        admin: accounts.admin?.publicKey ?? this.provider.wallet.publicKey,
      })
      .transaction();
    if (accounts.admin) {
      const blockhash = await TestUtil.provider.connection.getLatestBlockhash();
      const txId = await TestUtil.provider.connection.sendTransaction(tx, [
        accounts.admin,
      ]);
      await TestUtil.provider.connection.confirmTransaction(
        {
          signature: txId,
          ...blockhash,
        },
        "confirmed"
      );
      return txId;
    } else {
      return await this.provider.sendAndConfirm(tx, undefined);
    }
  }

  static async initVaultPeriod(
    vault: PublicKey,
    vaultPeriod: PublicKey,
    vaultProtoConfig: PublicKey,
    periodId: number
  ): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .initVaultPeriod({
        periodId: new u64(periodId),
      })
      .accounts({
        vaultPeriod: vaultPeriod.toBase58(),
        vault: vault.toBase58(),
        creator: this.provider.wallet.publicKey.toBase58(),
        systemProgram: ProgramUtil.systemProgram.programId.toBase58(),
      })
      .transaction();
    return await this.provider.sendAndConfirm(tx, undefined);
  }

  static async deposit(input: DepositTxParams): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .deposit({
        tokenADepositAmount: input.params.tokenADepositAmount,
        numberOfSwaps: input.params.numberOfSwaps,
      })
      .accounts({
        common: {
          vault: input.accounts.vault.toBase58(),
          vaultPeriodEnd: input.accounts.vaultPeriodEnd.toBase58(),
          userPosition: input.accounts.userPosition.toBase58(),
          userPositionNftMint: input.accounts.userPositionNftMint.toBase58(),
          vaultTokenAAccount: input.accounts.vaultTokenAAccount.toBase58(),
          userTokenAAccount: input.accounts.userTokenAAccount.toBase58(),
          userPositionNftAccount:
            input.accounts.userPositionNftAccount.toBase58(),
          depositor: input.accounts.depositor.toBase58(),
          referrer: input.accounts.referrer,
          tokenProgram: ProgramUtil.tokenProgram.programId.toBase58(),
          associatedTokenProgram:
            ProgramUtil.associatedTokenProgram.programId.toBase58(),
          rent: ProgramUtil.rentProgram.programId.toBase58(),
          systemProgram: ProgramUtil.systemProgram.programId.toBase58(),
        },
      })
      .transaction();
    return await this.provider.sendAndConfirm(tx, [
      input.signers.userPositionNftMint,
      input.signers.depositor,
    ]);
  }

  static async depositWithMetadata(
    input: DepositWithMetadataTxParams
  ): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .depositWithMetadata({
        tokenADepositAmount: input.params.tokenADepositAmount,
        numberOfSwaps: input.params.numberOfSwaps,
      })
      .accounts({
        common: {
          vault: input.accounts.vault.toBase58(),
          vaultPeriodEnd: input.accounts.vaultPeriodEnd.toBase58(),
          userPosition: input.accounts.userPosition.toBase58(),
          userPositionNftMint: input.accounts.userPositionNftMint.toBase58(),
          vaultTokenAAccount: input.accounts.vaultTokenAAccount.toBase58(),
          userTokenAAccount: input.accounts.userTokenAAccount.toBase58(),
          userPositionNftAccount:
            input.accounts.userPositionNftAccount.toBase58(),
          depositor: input.accounts.depositor.toBase58(),
          referrer: input.accounts.referrer,
          tokenProgram: ProgramUtil.tokenProgram.programId.toBase58(),
          associatedTokenProgram:
            ProgramUtil.associatedTokenProgram.programId.toBase58(),
          rent: ProgramUtil.rentProgram.programId.toBase58(),
          systemProgram: ProgramUtil.systemProgram.programId.toBase58(),
        },
        positionMetadataAccount:
          input.accounts.positionMetadataAccount.toBase58(),
        metadataProgram: ProgramUtil.metadataProgram.programId.toBase58(),
      })
      .transaction();
    return await this.provider.sendAndConfirm(tx, [
      input.signers.userPositionNftMint,
      input.signers.depositor,
    ]);
  }

  static async dripSPLTokenSwap(
    user: Keypair | Signer,
    dripFeeTokenAAccount: PublicKey,
    vault: PublicKey,
    vaultProtoConfig: PublicKey,
    vaultTokenAAccount: PublicKey,
    vaultTokenBAccount: PublicKey,
    lastVaultPeriod: PublicKey,
    currentVaultPeriod: PublicKey,
    swapTokenMint: PublicKey,
    swapTokenAAccount: PublicKey,
    swapTokenBAccount: PublicKey,
    swapFeeAccount: PublicKey,
    swapAuthority: PublicKey,
    swap: PublicKey
  ): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .dripSplTokenSwap()
      .accounts({
        common: {
          dripTriggerSource: user.publicKey.toBase58(),
          dripFeeTokenAAccount: dripFeeTokenAAccount.toBase58(),
          vault: vault.toBase58(),
          vaultProtoConfig: vaultProtoConfig.toBase58(),
          lastVaultPeriod: lastVaultPeriod.toBase58(),
          currentVaultPeriod: currentVaultPeriod.toBase58(),
          vaultTokenAAccount: vaultTokenAAccount.toBase58(),
          vaultTokenBAccount: vaultTokenBAccount.toBase58(),
          swapTokenAAccount: swapTokenAAccount.toBase58(),
          swapTokenBAccount: swapTokenBAccount.toBase58(),
          tokenProgram: ProgramUtil.tokenProgram.programId.toBase58(),
        },
        swapTokenMint: swapTokenMint.toBase58(),
        swapFeeAccount: swapFeeAccount.toBase58(),
        swap: swap.toBase58(),
        swapAuthority: swapAuthority.toBase58(),
        tokenSwapProgram: ProgramUtil.tokenSwapProgram.programId.toBase58(),
      })
      .transaction();
    return await this.provider.sendAndConfirm(tx, [user]);
  }

  static async dripOrcaWhirlpool(params: {
    botKeypair: Keypair | Signer;
    dripFeeTokenAAccount: PublicKey;
    vault: PublicKey;
    vaultProtoConfig: PublicKey;
    vaultTokenAAccount: PublicKey;
    vaultTokenBAccount: PublicKey;
    lastVaultPeriod: PublicKey;
    currentVaultPeriod: PublicKey;
    swapTokenAAccount: PublicKey;
    swapTokenBAccount: PublicKey;
    whirlpool: PublicKey;
    tickArray0: PublicKey;
    tickArray1: PublicKey;
    tickArray2: PublicKey;
    oracle: PublicKey;
  }): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .dripOrcaWhirlpool()
      .accounts({
        common: {
          dripTriggerSource: params.botKeypair.publicKey.toBase58(),
          vault: params.vault.toBase58(),
          vaultProtoConfig: params.vaultProtoConfig.toBase58(),
          lastVaultPeriod: params.lastVaultPeriod.toBase58(),
          currentVaultPeriod: params.currentVaultPeriod.toBase58(),
          vaultTokenAAccount: params.vaultTokenAAccount.toBase58(),
          vaultTokenBAccount: params.vaultTokenBAccount.toBase58(),
          swapTokenAAccount: params.swapTokenAAccount.toBase58(),
          swapTokenBAccount: params.swapTokenBAccount.toBase58(),
          dripFeeTokenAAccount: params.dripFeeTokenAAccount.toBase58(),
          tokenProgram: ProgramUtil.tokenProgram.programId.toBase58(),
        },
        whirlpool: params.whirlpool.toBase58(),
        tickArray0: params.tickArray0.toBase58(),
        tickArray1: params.tickArray1.toBase58(),
        tickArray2: params.tickArray2.toBase58(),
        oracle: params.oracle.toBase58(),
        whirlpoolProgram: ProgramUtil.orcaWhirlpoolProgram.programId.toBase58(),
      })
      .transaction();
    return await this.provider.sendAndConfirm(tx, [params.botKeypair]);
  }

  static async withdrawB(
    withdrawer: Keypair | Signer,
    vault: PublicKey,
    vaultProtoConfig: PublicKey,
    userPosition: PublicKey,
    userPositionNftAccount: PublicKey,
    vaultTokenBAccount: PublicKey,
    vaultTreasuryTokenBAccount: PublicKey,
    vaultPeriodI: PublicKey,
    vaultPeriodJ: PublicKey,
    userTokenBAccount: PublicKey,
    referrer?: PublicKey
  ): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .withdrawB()
      .accounts({
        common: {
          withdrawer: withdrawer.publicKey.toBase58(),
          vault: vault.toBase58(),
          vaultProtoConfig: vaultProtoConfig.toBase58(),
          vaultPeriodI: vaultPeriodI.toBase58(),
          vaultPeriodJ: vaultPeriodJ.toBase58(),
          userPosition: userPosition.toBase58(),
          userPositionNftAccount: userPositionNftAccount.toBase58(),
          vaultTokenBAccount: vaultTokenBAccount.toBase58(),
          vaultTreasuryTokenBAccount: vaultTreasuryTokenBAccount.toBase58(),
          userTokenBAccount: userTokenBAccount.toBase58(),
          referrer: referrer
            ? referrer.toBase58()
            : vaultTreasuryTokenBAccount.toBase58(),
          tokenProgram: ProgramUtil.tokenProgram.programId.toBase58(),
        },
      })
      .transaction();
    return this.provider.sendAndConfirm(tx, [withdrawer]);
  }

  static async closePosition(
    withdrawer: Keypair | Signer,
    vault: PublicKey,
    vaultProtoConfig: PublicKey,
    userPosition: PublicKey,
    vaultPeriodI: PublicKey,
    vaultPeriodJ: PublicKey,
    vaultPeriodUserExpiry: PublicKey,
    vaultTokenAAccount: PublicKey,
    vaultTokenBAccount: PublicKey,
    vaultTreasuryTokenBAccount: PublicKey,
    userTokenAAccount: PublicKey,
    userTokenBAccount: PublicKey,
    userPositionNftAccount: PublicKey,
    userPositionNftMint: PublicKey,
    referrer?: PublicKey
  ): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .closePosition()
      .accounts({
        common: {
          vault: vault.toBase58(),
          vaultProtoConfig: vaultProtoConfig.toBase58(),
          vaultPeriodI: vaultPeriodI.toBase58(),
          vaultPeriodJ: vaultPeriodJ.toBase58(),
          userPosition: userPosition.toBase58(),
          userPositionNftAccount: userPositionNftAccount.toBase58(),
          vaultTokenBAccount: vaultTokenBAccount.toBase58(),
          vaultTreasuryTokenBAccount: vaultTreasuryTokenBAccount.toBase58(),
          userTokenBAccount: userTokenBAccount.toBase58(),
          withdrawer: withdrawer.publicKey.toBase58(),
          referrer: referrer
            ? referrer.toBase58()
            : vaultTreasuryTokenBAccount.toBase58(),
          tokenProgram: ProgramUtil.tokenProgram.programId.toBase58(),
        },
        vaultPeriodUserExpiry: vaultPeriodUserExpiry.toBase58(),
        vaultTokenAAccount: vaultTokenAAccount.toBase58(),
        userTokenAAccount: userTokenAAccount.toBase58(),
        userPositionNftMint: userPositionNftMint.toBase58(),
      })
      .transaction();
    return this.provider.sendAndConfirm(tx, [withdrawer]);
  }

  static async initOracleConfig(
    accounts: {
      oracleConfig: Keypair | Signer;
      tokenAMint: PublicKey;
      tokenAPrice: PublicKey;
      tokenBMint: PublicKey;
      tokenBPrice: PublicKey;
    },
    params: {
      enabled: boolean;
      source: number;
      updateAuthority: PublicKey;
    }
  ): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .initOracleConfig({
        ...params,
      })
      .accounts({
        ...accounts,
        oracleConfig: accounts.oracleConfig.publicKey.toString(),
        creator: this.provider.wallet.publicKey,
        systemProgram: ProgramUtil.systemProgram.programId,
      })
      .transaction();
    return this.provider.sendAndConfirm(tx, [accounts.oracleConfig]);
  }

  /*
    Deploy Vault Proto Config if not provided
    Create token accounts
    Deploy Vault
    Deposit into vault
    Create Vault Periods
   */
  static async deployVault({
    tokenA,
    tokenB,
    vaultProtoConfig,
    whitelistedSwaps,
    tokenOwnerKeypair = generatePair(),
    maxSlippageBps = 1000,
    adminKeypair = generatePair(),
    botKeypair = generatePair(),
    userKeypair = generatePair(),
    vaultPeriodIndex = 10,
  }: {
    tokenA?: Token;
    tokenB?: Token;
    tokenOwnerKeypair?: Keypair;
    maxSlippageBps?: number;
    adminKeypair?: Keypair;
    botKeypair?: Keypair;
    userKeypair?: Keypair;
    vaultProtoConfig?: PublicKey;
    whitelistedSwaps?: PublicKey[];
    vaultPeriodIndex?: number;
  }): Promise<DeployVaultRes> {
    await Promise.all([
      SolUtil.fundAccount(adminKeypair.publicKey, SolUtil.solToLamports(0.1)),
      SolUtil.fundAccount(userKeypair.publicKey, SolUtil.solToLamports(0.1)),
      SolUtil.fundAccount(
        tokenOwnerKeypair.publicKey,
        SolUtil.solToLamports(0.1)
      ),
      SolUtil.fundAccount(botKeypair.publicKey, SolUtil.solToLamports(0.1)),
    ]);

    if (!tokenA) {
      tokenA = await TokenUtil.createMint(
        tokenOwnerKeypair.publicKey,
        null,
        6,
        tokenOwnerKeypair
      );
    }
    if (!tokenB) {
      tokenB = await TokenUtil.createMint(
        tokenOwnerKeypair.publicKey,
        null,
        6,
        tokenOwnerKeypair
      );
    }
    const mintAmount = await TokenUtil.scaleAmount(
      amount(2, Denom.Thousand),
      tokenA
    );
    const userTokenAAccount = await tokenA.createAssociatedTokenAccount(
      userKeypair.publicKey
    );
    await tokenA.mintTo(userTokenAAccount, tokenOwnerKeypair, [], mintAmount);

    const vaultTreasuryTokenBAccount = await TokenUtil.createTokenAccount(
      tokenB,
      adminKeypair.publicKey
    );
    const botTokenAAcount = await tokenA.createAssociatedTokenAccount(
      botKeypair.publicKey
    );

    if (!vaultProtoConfig) {
      const vaultProtoConfigKeypair = generatePair();
      await DripUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
        granularity: 1,
        tokenADripTriggerSpread: 10,
        tokenBWithdrawalSpread: 10,
        tokenBReferralSpread: 10,
        admin: adminKeypair.publicKey,
      });
      vaultProtoConfig = vaultProtoConfigKeypair.publicKey;
    }

    const vaultPDA = await getVaultPDA(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultProtoConfig
    );
    const [vaultTokenAAccount, vaultTokenBAccount] = await Promise.all([
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
    ]);
    const initVaultAccounts = {
      vaultPubkey: vaultPDA.publicKey,
      vaultProtoConfigAccount: vaultProtoConfig,
      tokenAMint: tokenA.publicKey,
      tokenBMint: tokenB.publicKey,
      tokenAAccount: vaultTokenAAccount,
      tokenBAccount: vaultTokenBAccount,
      treasuryTokenBAccount: vaultTreasuryTokenBAccount,
    };
    const initVaultParams = {
      whitelistedSwaps,
      maxSlippageBps,
    };
    await DripUtil.initVault(
      initVaultAccounts,
      initVaultParams,
      undefined,
      adminKeypair
    );

    const vaultPeriods = (
      await Promise.all(
        [...Array(vaultPeriodIndex).keys()].map((i) =>
          deployVaultPeriod(
            vaultProtoConfig,
            vaultPDA.publicKey,
            tokenA.publicKey,
            tokenB.publicKey,
            i
          )
        )
      )
    ).map((vaultPeriodPDA: PDA) => {
      return vaultPeriodPDA.publicKey;
    });

    const depositAmount = await TokenUtil.scaleAmount(
      amount(1, Denom.Thousand),
      tokenA
    );

    await depositToVault(
      userKeypair,
      tokenA,
      depositAmount,
      new u64(4),
      vaultPDA.publicKey,
      vaultPeriods[4],
      userTokenAAccount,
      vaultTreasuryTokenBAccount
    );

    return {
      vault: vaultPDA.publicKey,
      vaultProtoConfig,
      vaultPeriods,
      userTokenAAccount,
      botKeypair,
      botTokenAAcount,
      vaultTreasuryTokenBAccount,
      vaultTokenAAccount,
      vaultTokenBAccount,
      tokenAMint: tokenA,
      tokenBMint: tokenB,
      admin: adminKeypair,
    };
  }
}
