import { web3, BN } from "@project-serum/anchor";
import { TestUtil } from "./config";
import { ProgramUtils } from "./ProgramUtils";
import { Granularity } from "./Granularity";
import { PDA } from "./PDAUtils";

export type VaultProtoConfig = {
  granularity: Granularity,
}

export class VaultUtils extends TestUtil {
  static async initVaultProtoConfig(
    vaultProtoConfigKeypair: web3.Signer,
    vaultProtoConfig: VaultProtoConfig, 
  ): Promise<void> {
    await ProgramUtils.vaultProgram.rpc.initVaultProtoConfig(new BN(vaultProtoConfig.granularity.toString()), {
      accounts: {
        vaultProtoConfig: vaultProtoConfigKeypair.publicKey,
        creator: this.provider.wallet.publicKey,
        systemProgram: ProgramUtils.systemProgram.programId,
      },
      signers: [vaultProtoConfigKeypair]
    })
  }

  static async initVault(
    vaultPDA: PDA,
    vaultProtoConfigAccount: web3.PublicKey,
    tokenAMint: web3.PublicKey,
    tokenBMint: web3.PublicKey,
    tokenAAccountPDA: PDA,
    tokenBAccountPDA: PDA,
  ): Promise<void> {
    await ProgramUtils.vaultProgram.rpc.initVault({
      vault: vaultPDA.bump,
      tokenAAccount: tokenAAccountPDA.bump,
      tokenBAccount: tokenBAccountPDA.bump,
    }, {
      accounts: {
        vault: vaultPDA.pubkey,
        vaultProtoConfig: vaultProtoConfigAccount,
        tokenAMint,
        tokenBMint,
        tokenAAccount: tokenAAccountPDA.pubkey,
        tokenBAccount: tokenBAccountPDA.pubkey,
        creator: this.provider.wallet.publicKey,
        systemProgram: ProgramUtils.systemProgram.programId,
        tokenProgram: ProgramUtils.tokenProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    });
  }
}