import { BN, web3 } from "@project-serum/anchor";
import { TestUtil } from "./config";
import { ProgramUtils } from "./ProgramUtils";
import { Granularity } from "./Granularity";
import { PDA } from "./PDAUtils";
import { PublicKey, Signer } from "@solana/web3.js";
import { u64 } from "@solana/spl-token";

export type VaultProtoConfig = {
  granularity: Granularity;
};

export class VaultUtils extends TestUtil {
  static async initVaultProtoConfig(
    vaultProtoConfigKeypair: web3.Signer,
    vaultProtoConfig: VaultProtoConfig
  ): Promise<void> {
    await ProgramUtils.vaultProgram.rpc.initVaultProtoConfig(
      new BN(vaultProtoConfig.granularity),
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
}
