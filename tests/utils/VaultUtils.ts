import { BN, web3 } from "@project-serum/anchor";
import { TestUtil } from "./config";
import { ProgramUtils } from "./ProgramUtils";
import { Granularity } from "./Granularity";
import { PDA } from "./PDAUtils";
import {PublicKey, Signer} from "@solana/web3.js";

export type VaultProtoConfig = {
  granularity: Granularity,
}

export class VaultUtils extends TestUtil {
  static async initVaultProtoConfig(
    vaultProtoConfigKeypair: web3.Signer,
    vaultProtoConfig: VaultProtoConfig, 
  ): Promise<void> {
    await ProgramUtils.vaultProgram.rpc.initVaultProtoConfig(new BN(vaultProtoConfig.granularity), {
      accounts: {
        vaultProtoConfig: vaultProtoConfigKeypair.publicKey.toString(),
        creator: this.provider.wallet.publicKey.toString(),
        systemProgram: ProgramUtils.systemProgram.programId.toString(),
      },
      signers: [vaultProtoConfigKeypair as Signer]
    });
  }

  static async initVault(
    vaultPDA: PDA,
    vaultProtoConfigAccount: web3.PublicKey,
    tokenAMint: web3.PublicKey,
    tokenBMint: web3.PublicKey,
    tokenA_ATA: web3.PublicKey,
    tokenB_ATA: web3.PublicKey,
  ): Promise<void> {
    const accounts = {
      vault: vaultPDA.pubkey.toString(),
      vaultProtoConfig: vaultProtoConfigAccount.toString(),
      tokenAMint: tokenAMint.toString(),
      tokenBMint: tokenBMint.toString(),
      tokenAAccount: tokenA_ATA.toString(),
      tokenBAccount: tokenB_ATA.toString(),
      creator: this.provider.wallet.publicKey.toString(),
      systemProgram: ProgramUtils.systemProgram.programId.toString(),
      tokenProgram: ProgramUtils.tokenProgram.programId.toString(),
      associatedTokenProgram: ProgramUtils.associatedTokenProgram.programId.toString(),
      rent: web3.SYSVAR_RENT_PUBKEY,
    };
    await ProgramUtils.vaultProgram.rpc.initVault( {
      accounts: accounts,
    });
  }
}