import { web3 } from "@project-serum/anchor";
import { TestUtil } from "./config";
import { ProgramUtils } from "./ProgramUtils";
import { AsyncReturnType } from "./types";

export class AccountUtils extends TestUtil {
  static async fetchAccountData(pubkey: web3.PublicKey): Promise<Buffer> {
    const account = await this.provider.connection.getAccountInfo(pubkey);
    return account.data;
  }

  static async fetchVaultProtoConfigAccount(
    pubkey: web3.PublicKey
  ): Promise<
       Pick<
         AsyncReturnType<typeof ProgramUtils.vaultProgram.account.vaultProtoConfig.fetch>,
         'granularity'
       >
     > 
  {
    return await ProgramUtils.vaultProgram.account.vaultProtoConfig.fetch(pubkey);
  }

  static async fetchVaultAccount(
    pubkey: web3.PublicKey
  ): Promise<
       Pick<
         AsyncReturnType<typeof ProgramUtils.vaultProgram.account.vault.fetch>,
         'protoConfig' |
         'tokenAMint' |
         'tokenBMint' |
         'tokenAAccount' |
         'tokenBAccount' |
         'lastDcaPeriod' |
         'dripAmount' |
         'startTimestamp'
       >
     > 
  {
    return await ProgramUtils.vaultProgram.account.vault.fetch(pubkey);
  }
}