import { web3, BN } from "@project-serum/anchor";
import { TestUtil } from "./config";
import { ProgramUtils } from "./ProgramUtils";
import { AsyncReturnType } from "./types";

const MILLISECONDS_IN_A_DAY = 24 * 60 * 60 * 1000;

export class VaultUtils extends TestUtil {
  static get defaultGranularity(): number {
    return MILLISECONDS_IN_A_DAY;
  }

  static async initVaultProtoConfig(granularity: number = VaultUtils.defaultGranularity, vaultProtoConfigKeypair: web3.Signer): Promise<
    Pick<AsyncReturnType<typeof ProgramUtils.vaultProgram.account.vaultProtoConfig.fetch>, 'granularity'>
  > {
    const _granularity = new BN(granularity);

    await ProgramUtils.vaultProgram.rpc.initVaultProtoConfig(_granularity, {
      accounts: {
        vaultProtoConfig: vaultProtoConfigKeypair.publicKey,
        creator: this.provider.wallet.publicKey,
        systemProgram: ProgramUtils.systemProgram.programId,
      },
      signers: [vaultProtoConfigKeypair]
    })

    const vaultProtoConfigAccount = await ProgramUtils.vaultProgram.account.vaultProtoConfig.fetch(vaultProtoConfigKeypair.publicKey);

    return vaultProtoConfigAccount;
  }

  static async initVault(
    vault: {
      account: web3.PublicKey,
      protoConfigAccount: web3.PublicKey,
      bump: number,
    },
    tokenA: {
      account: web3.PublicKey,
      mint: web3.PublicKey,
      bump: number,
    },
    tokenB: {
      account: web3.PublicKey,
      mint: web3.PublicKey,
      bump: number,
    },
  ): Promise<
    Pick<AsyncReturnType<typeof ProgramUtils.vaultProgram.account.vault.fetch>, 'protoConfig' | 'tokenAAccount' | 'tokenAMint' | 'tokenBAccount' | 'tokenBMint'>
  > {
    await ProgramUtils.vaultProgram.rpc.initVault({
      vault: vault.bump,
      tokenAAccount: tokenA.bump,
      tokenBAccount: tokenB.bump,
    }, {
      accounts: {
        vault: vault.account,
        vaultProtoConfig: vault.protoConfigAccount,
        tokenAMint: tokenA.mint,
        tokenBMint: tokenB.mint,
        tokenAAccount: tokenA.account,
        tokenBAccount: tokenB.account,
        creator: this.provider.wallet.publicKey,
        systemProgram: ProgramUtils.systemProgram.programId,
        tokenProgram: ProgramUtils.tokenProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    });

    const vaultAccount = await ProgramUtils.vaultProgram.account.vault.fetch(vault.account);

    return vaultAccount;
  }
}