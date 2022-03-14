import { TestUtil } from "./config";
import { ProgramUtil } from "./Program.util";
import {
  Keypair,
  PublicKey,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import { u64 } from "@solana/spl-token";
import { Granularity } from "./common.util";

export type VaultProtoConfig = {
  granularity: Granularity;
};

export interface DepositTxParams {
  accounts: {
    vault: PublicKey;
    vaultPeriodEnd: PublicKey;
    userPosition: PublicKey;
    tokenAMint: PublicKey;
    userPositionNftMint: PublicKey;
    vaultTokenAAccount: PublicKey;
    userTokenAAccount: PublicKey;
    userPositionNftAccount: PublicKey;
    depositor: PublicKey;
  };
  signers: {
    depositor: Signer;
    userPositionNftMint: Signer;
  };
  params: {
    tokenADepositAmount: u64;
    dcaCycles: u64;
  };
}

export class VaultUtil extends TestUtil {
  static async initVaultProtoConfig(
    vaultProtoConfigKeypair: Signer,
    vaultProtoConfig: VaultProtoConfig
  ): Promise<TransactionSignature> {
    const accounts = {
      vaultProtoConfig: vaultProtoConfigKeypair.publicKey.toString(),
      creator: this.provider.wallet.publicKey.toString(),
      systemProgram: ProgramUtil.systemProgram.programId.toString(),
    };

    // console.log(JSON.stringify(accounts, undefined, 2));
    return await ProgramUtil.vaultProgram.rpc.initVaultProtoConfig(
      {
        granularity: new u64(vaultProtoConfig.granularity),
      },
      {
        accounts,
        signers: [vaultProtoConfigKeypair],
      }
    );
  }

  static async initVault(
    vaultPubkey: PublicKey,
    vaultProtoConfigAccount: PublicKey,
    tokenAMint: PublicKey,
    tokenBMint: PublicKey,
    tokenA_ATA: PublicKey,
    tokenB_ATA: PublicKey,
    programs?: {
      systemProgram?: PublicKey;
      tokenProgram?: PublicKey;
      associatedTokenProgram?: PublicKey;
      rent?: PublicKey;
    }
  ): Promise<TransactionSignature> {
    const accounts = {
      vault: vaultPubkey.toBase58(),
      vaultProtoConfig: vaultProtoConfigAccount.toBase58(),
      tokenAMint: tokenAMint.toBase58(),
      tokenBMint: tokenBMint.toBase58(),
      tokenAAccount: tokenA_ATA.toBase58(),
      tokenBAccount: tokenB_ATA.toBase58(),
      creator: this.provider.wallet.publicKey.toBase58(),
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
    };

    // console.log(JSON.stringify(accounts, undefined, 2));
    return await ProgramUtil.vaultProgram.rpc.initVault({
      accounts: accounts,
    });
  }

  static async initVaultPeriod(
    vault: PublicKey,
    vaultPeriod: PublicKey,
    vaultProtoConfig: PublicKey,
    tokenAMint: PublicKey,
    tokenBMint: PublicKey,
    periodId: number
  ): Promise<TransactionSignature> {
    const accounts = {
      vault: vault.toBase58(),
      vaultPeriod: vaultPeriod.toBase58(),
      vaultProtoConfig: vaultProtoConfig.toBase58(),
      tokenAMint: tokenAMint.toBase58(),
      tokenBMint: tokenBMint.toBase58(),
      creator: this.provider.wallet.publicKey.toBase58(),
      systemProgram: ProgramUtil.systemProgram.programId.toBase58(),
    };

    // console.log(JSON.stringify(accounts, undefined, 2));
    return await ProgramUtil.vaultProgram.rpc.initVaultPeriod(
      {
        periodId: new u64(periodId),
      },
      {
        accounts,
      }
    );
  }

  static async deposit(input: DepositTxParams): Promise<TransactionSignature> {
    const accounts = {
      vault: input.accounts.vault.toBase58(),
      vaultPeriodEnd: input.accounts.vaultPeriodEnd.toBase58(),
      userPosition: input.accounts.userPosition.toBase58(),
      tokenAMint: input.accounts.tokenAMint.toBase58(),
      userPositionNftMint: input.accounts.userPositionNftMint.toBase58(),
      vaultTokenAAccount: input.accounts.vaultTokenAAccount.toBase58(),
      userTokenAAccount: input.accounts.userTokenAAccount.toBase58(),
      userPositionNftAccount: input.accounts.userPositionNftAccount.toBase58(),
      depositor: input.accounts.depositor.toBase58(),
      tokenProgram: ProgramUtil.tokenProgram.programId.toBase58(),
      associatedTokenProgram:
        ProgramUtil.associatedTokenProgram.programId.toBase58(),
      rent: ProgramUtil.rentProgram.programId.toBase58(),
      systemProgram: ProgramUtil.systemProgram.programId.toBase58(),
    };

    // console.log(JSON.stringify(accounts, undefined, 2));
    return await ProgramUtil.vaultProgram.rpc.deposit(
      {
        tokenADepositAmount: input.params.tokenADepositAmount,
        dcaCycles: input.params.dcaCycles,
      },
      {
        accounts,
        signers: [input.signers.depositor, input.signers.userPositionNftMint],
      }
    );
  }

  static async triggerDCA(
    user: Keypair | Signer,
    vault: PublicKey,
    vaultProtoConfig: PublicKey,
    vaultTokenAAccount: PublicKey,
    vaultTokenBAccount: PublicKey,
    lastVaultPeriod: PublicKey,
    currentVaultPeriod: PublicKey,
    tokenAMint: PublicKey,
    tokenBMint: PublicKey,
    swapTokenMint: PublicKey,
    swapTokenAAccount: PublicKey,
    swapTokenBAccount: PublicKey,
    swapFeeAccount: PublicKey,
    swapAuthority: PublicKey,
    swap: PublicKey
  ): Promise<TransactionSignature> {
    const accounts = {
      dcaTriggerSource: user.publicKey.toBase58(),
      vault: vault.toBase58(),
      vaultProtoConfig: vaultProtoConfig.toBase58(),
      lastVaultPeriod: lastVaultPeriod.toBase58(),
      currentVaultPeriod: currentVaultPeriod.toBase58(),
      swapTokenMint: swapTokenMint.toBase58(),
      tokenAMint: tokenAMint.toBase58(),
      tokenBMint: tokenBMint.toBase58(),
      vaultTokenAAccount: vaultTokenAAccount.toBase58(),
      vaultTokenBAccount: vaultTokenBAccount.toBase58(),
      swapTokenAAccount: swapTokenAAccount.toBase58(),
      swapTokenBAccount: swapTokenBAccount.toBase58(),
      swapFeeAccount: swapFeeAccount.toBase58(),
      swap: swap.toBase58(),
      swapAuthority: swapAuthority.toBase58(),
      tokenSwapProgram: ProgramUtil.tokenSwapProgram.programId.toBase58(),
      tokenProgram: ProgramUtil.tokenProgram.programId.toBase58(),
      associatedTokenProgram:
        ProgramUtil.associatedTokenProgram.programId.toBase58(),
      systemProgram: ProgramUtil.systemProgram.programId.toBase58(),
      rent: ProgramUtil.rentProgram.programId.toBase58(),
    };

    // console.log(JSON.stringify(accounts, undefined, 2));
    return await ProgramUtil.vaultProgram.rpc.triggerDca({
      accounts,
      signers: [user],
    });
  }

  static async withdrawB(
    withdrawer: Keypair | Signer,
    vault: PublicKey,
    userPosition: PublicKey,
    userPositionNftAccount: PublicKey,
    userPositionNftMint: PublicKey,
    vaultTokenAAccount: PublicKey,
    vaultTokenBAccount: PublicKey,
    vaultPeriodI: PublicKey,
    vaultPeriodJ: PublicKey,
    tokenBMint: PublicKey,
    userTokenBAccount: PublicKey
  ): Promise<TransactionSignature> {
    const accounts = {
      withdrawer: withdrawer.publicKey.toBase58(),
      vault: vault.toBase58(),
      vaultPeriodI: vaultPeriodI.toBase58(),
      vaultPeriodJ: vaultPeriodJ.toBase58(),
      userPosition: userPosition.toBase58(),
      userPositionNftAccount: userPositionNftAccount.toBase58(),
      userPositionNftMint: userPositionNftMint.toBase58(),
      vaultTokenAAccount: vaultTokenAAccount.toBase58(),
      vaultTokenBAccount: vaultTokenBAccount.toBase58(),
      vaultTokenBMint: tokenBMint.toBase58(),
      userTokenBAccount: userTokenBAccount.toBase58(),
      tokenProgram: ProgramUtil.tokenProgram.programId.toBase58(),
      associatedTokenProgram:
        ProgramUtil.associatedTokenProgram.programId.toBase58(),
    };

    // console.log(JSON.stringify(accounts, undefined, 2));
    return await ProgramUtil.vaultProgram.rpc.withdrawB({
      accounts: accounts,
      signers: [withdrawer],
    });
  }

  static async closePosition(
    withdrawer: Keypair | Signer,
    vault: PublicKey,
    userPosition: PublicKey,
    vaultPeriodI: PublicKey,
    vaultPeriodJ: PublicKey,
    vaultPeriodUserExpiry: PublicKey,

    vaultTokenAAccount: PublicKey,
    vaultTokenBAccount: PublicKey,
    userTokenAAccount: PublicKey,
    userTokenBAccount: PublicKey,

    userPositionNftAccount: PublicKey,

    userPositionNftMint: PublicKey,
    tokenAMint: PublicKey,
    tokenBMint: PublicKey
  ): Promise<TransactionSignature> {
    const accounts = {
      vault: vault.toBase58(),
      vaultPeriodI: vaultPeriodI.toBase58(),
      vaultPeriodJ: vaultPeriodJ.toBase58(),
      vaultPeriodUserExpiry: vaultPeriodUserExpiry.toBase58(),
      userPosition: userPosition.toBase58(),

      vaultTokenAAccount: vaultTokenAAccount.toBase58(),
      vaultTokenBAccount: vaultTokenBAccount.toBase58(),
      userTokenAAccount: userTokenAAccount.toBase58(),
      userTokenBAccount: userTokenBAccount.toBase58(),

      userPositionNftAccount: userPositionNftAccount.toBase58(),

      userPositionNftMint: userPositionNftMint.toBase58(),
      tokenAMint: tokenAMint.toBase58(),
      tokenBMint: tokenBMint.toBase58(),

      withdrawer: withdrawer.publicKey.toBase58(),
      tokenProgram: ProgramUtil.tokenProgram.programId.toBase58(),
      systemProgram: ProgramUtil.systemProgram.programId.toBase58(),
    };

    // console.log(JSON.stringify(accounts, undefined, 2));
    return await ProgramUtil.vaultProgram.rpc.closePosition({
      accounts,
      signers: [withdrawer],
    });
  }
}
