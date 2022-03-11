import { TestUtil } from "./config";
import { ProgramUtil } from "./Program.util";
import { PublicKey, Signer } from "@solana/web3.js";
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
  ): Promise<void> {
    await ProgramUtil.vaultProgram.rpc.initVaultProtoConfig(
      {
        granularity: new u64(vaultProtoConfig.granularity),
      },
      {
        accounts: {
          vaultProtoConfig: vaultProtoConfigKeypair.publicKey.toString(),
          creator: this.provider.wallet.publicKey.toString(),
          systemProgram: ProgramUtil.systemProgram.programId.toString(),
        },
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
  ): Promise<void> {
    const accounts = {
      vault: vaultPubkey.toString(),
      vaultProtoConfig: vaultProtoConfigAccount.toString(),
      tokenAMint: tokenAMint.toString(),
      tokenBMint: tokenBMint.toString(),
      tokenAAccount: tokenA_ATA.toString(),
      tokenBAccount: tokenB_ATA.toString(),
      creator: this.provider.wallet.publicKey.toString(),
      systemProgram:
        programs?.systemProgram?.toString() ??
        ProgramUtil.systemProgram.programId.toString(),
      tokenProgram:
        programs?.tokenProgram?.toString() ??
        ProgramUtil.tokenProgram.programId.toString(),
      associatedTokenProgram:
        programs?.associatedTokenProgram?.toString() ??
        ProgramUtil.associatedTokenProgram.programId.toString(),
      rent:
        programs?.rent?.toString() ??
        ProgramUtil.rentProgram.programId.toString(),
    };
    await ProgramUtil.vaultProgram.rpc.initVault({
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
  ): Promise<void> {
    const accounts = {
      vault: vault.toString(),
      vaultPeriod: vaultPeriod.toString(),
      vaultProtoConfig: vaultProtoConfig.toString(),
      tokenAMint: tokenAMint.toString(),
      tokenBMint: tokenBMint.toString(),
      creator: this.provider.wallet.publicKey.toString(),
      systemProgram: ProgramUtil.systemProgram.programId.toString(),
    };

    await ProgramUtil.vaultProgram.rpc.initVaultPeriod(
      {
        periodId: new u64(periodId),
      },
      {
        accounts: accounts,
      }
    );
  }

  static async deposit(input: DepositTxParams): Promise<void> {
    await ProgramUtil.vaultProgram.rpc.deposit(
      {
        tokenADepositAmount: input.params.tokenADepositAmount,
        dcaCycles: input.params.dcaCycles,
      },
      {
        accounts: {
          vault: input.accounts.vault.toBase58(),
          vaultPeriodEnd: input.accounts.vaultPeriodEnd.toBase58(),
          userPosition: input.accounts.userPosition.toBase58(),
          tokenAMint: input.accounts.tokenAMint.toBase58(),
          userPositionNftMint: input.accounts.userPositionNftMint.toBase58(),
          vaultTokenAAccount: input.accounts.vaultTokenAAccount.toBase58(),
          userTokenAAccount: input.accounts.userTokenAAccount.toBase58(),
          userPositionNftAccount:
            input.accounts.userPositionNftAccount.toBase58(),
          depositor: input.accounts.depositor.toBase58(),
          tokenProgram: ProgramUtil.tokenProgram.programId.toBase58(),
          associatedTokenProgram:
            ProgramUtil.associatedTokenProgram.programId.toBase58(),
          rent: ProgramUtil.rentProgram.programId.toBase58(),
          systemProgram: ProgramUtil.systemProgram.programId.toBase58(),
        },
        signers: [input.signers.depositor, input.signers.userPositionNftMint],
      }
    );
  }
}
