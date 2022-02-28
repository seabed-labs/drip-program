import { web3 } from "@project-serum/anchor";
import { TestUtil } from "./config";
import { ProgramUtils } from "./ProgramUtils";
import { Granularity } from "./Granularity";
import { PublicKey, Signer } from "@solana/web3.js";
import { u64 } from "@solana/spl-token";

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

export class VaultUtils extends TestUtil {
  static async initVaultProtoConfig(
    vaultProtoConfigKeypair: web3.Signer,
    vaultProtoConfig: VaultProtoConfig
  ): Promise<void> {
    await ProgramUtils.vaultProgram.rpc.initVaultProtoConfig(
      {
        granularity: new u64(vaultProtoConfig.granularity),
      },
      {
        accounts: {
          vaultProtoConfig: vaultProtoConfigKeypair.publicKey.toString(),
          creator: this.provider.wallet.publicKey.toString(),
          systemProgram: ProgramUtils.systemProgram.programId.toString(),
        },
        signers: [vaultProtoConfigKeypair as Signer],
      }
    );
  }

  static async initVault(
    vaultPubkey: web3.PublicKey,
    vaultProtoConfigAccount: web3.PublicKey,
    tokenAMint: web3.PublicKey,
    tokenBMint: web3.PublicKey,
    tokenA_ATA: web3.PublicKey,
    tokenB_ATA: web3.PublicKey,
    programs?: {
      systemProgram?: web3.PublicKey;
      tokenProgram?: web3.PublicKey;
      associatedTokenProgram?: web3.PublicKey;
      rent?: web3.PublicKey;
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
        ProgramUtils.systemProgram.programId.toString(),
      tokenProgram:
        programs?.tokenProgram?.toString() ??
        ProgramUtils.tokenProgram.programId.toString(),
      associatedTokenProgram:
        programs?.associatedTokenProgram?.toString() ??
        ProgramUtils.associatedTokenProgram.programId.toString(),
      rent:
        programs?.rent?.toString() ??
        ProgramUtils.rentProgram.programId.toString(),
    };
    await ProgramUtils.vaultProgram.rpc.initVault({
      accounts: accounts,
    });
  }

  static async initVaultPeriod(
    vault: web3.PublicKey,
    vaultPeriod: web3.PublicKey,
    vaultProtoConfig: web3.PublicKey,
    tokenAMint: web3.PublicKey,
    tokenBMint: web3.PublicKey,
    periodId: number
  ): Promise<void> {
    const accounts = {
      vault: vault.toString(),
      vaultPeriod: vaultPeriod.toString(),
      vaultProtoConfig: vaultProtoConfig.toString(),
      tokenAMint: tokenAMint.toString(),
      tokenBMint: tokenBMint.toString(),
      creator: this.provider.wallet.publicKey.toString(),
      systemProgram: ProgramUtils.systemProgram.programId.toString(),
    };

    await ProgramUtils.vaultProgram.rpc.initVaultPeriod(
      {
        periodId: new u64(periodId),
      },
      {
        accounts: accounts,
      }
    );
  }

  static async deposit(input: DepositTxParams): Promise<void> {
    await ProgramUtils.vaultProgram.rpc.deposit(
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
          tokenProgram: ProgramUtils.tokenProgram.programId.toBase58(),
          associatedTokenProgram:
            ProgramUtils.associatedTokenProgram.programId.toBase58(),
          rent: ProgramUtils.rentProgram.programId.toBase58(),
          systemProgram: ProgramUtils.systemProgram.programId.toBase58(),
        },
        signers: [input.signers.depositor, input.signers.userPositionNftMint],
      }
    );
  }
}
