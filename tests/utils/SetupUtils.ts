import { web3 } from "@project-serum/anchor";
import { TestUtil } from "./config";
import { KeypairUtils } from "./KeypairUtils";
import { PDA } from "./PDAUtils";
import { AsyncReturnType } from "./types";
import { VaultUtils } from "./VaultUtils";

export class SetupUtils extends TestUtil {
  static async setupVaultProtoConfig(granularity: number = VaultUtils.defaultGranularity): Promise<{
    vaultProtoConfigAccount: AsyncReturnType<typeof VaultUtils.initVaultProtoConfig>,
    vaultProtoConfigAccountPubkey: web3.PublicKey,
  }> {
    const vaultProtoConfigAccount = KeypairUtils.generatePair();
    return {
      vaultProtoConfigAccount: await VaultUtils.initVaultProtoConfig(granularity, vaultProtoConfigAccount),
      vaultProtoConfigAccountPubkey: vaultProtoConfigAccount.publicKey,
    };
  }

  static async setupVault(
    protoConfigPubkey: web3.PublicKey,
    vaultPDA: PDA,
    tokenAMint: web3.PublicKey,
    tokenBMint: web3.PublicKey,
    tokenAAccountPDA: PDA,
    tokenBAccountPDA: PDA,
  ): Promise<{
    vaultAccount: AsyncReturnType<typeof VaultUtils.initVault>,
    vaultAccountPubkey: web3.PublicKey,
  }> {
    return {
      vaultAccount: await VaultUtils.initVault(
        {
          account: vaultPDA.pubkey,
          protoConfigAccount: protoConfigPubkey,
          bump: vaultPDA.bump,
        },
        {
          account: tokenAAccountPDA.pubkey,
          mint: tokenAMint,
          bump: tokenAAccountPDA.bump,
        },
        {
          account: tokenBAccountPDA.pubkey,
          mint: tokenBMint,
          bump: tokenBAccountPDA.bump,
        }
      ),
      vaultAccountPubkey: vaultPDA.pubkey,
    };
  }
}