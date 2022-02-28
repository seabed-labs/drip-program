import { web3 } from "@project-serum/anchor";
import { TestUtil } from "./config";
import { ProgramUtils } from "./ProgramUtils";
import { AsyncReturnType } from "./types";
import { AccountInfo, PublicKey } from "@solana/web3.js";

export class AccountUtils extends TestUtil {
  static async fetchAccountInfo(
    pubkey: web3.PublicKey
  ): Promise<AccountInfo<unknown>> {
    return await this.provider.connection.getAccountInfo(pubkey as PublicKey);
  }

  static async fetchAccountData(pubkey: web3.PublicKey): Promise<Buffer> {
    const account = await this.provider.connection.getAccountInfo(
      pubkey as PublicKey
    );
    return account.data;
  }

  static async fetchVaultProtoConfigAccount(
    pubkey: web3.PublicKey
  ): Promise<
    Pick<
      AsyncReturnType<
        typeof ProgramUtils.vaultProgram.account.vaultProtoConfig.fetch
      >,
      "granularity"
    >
  > {
    return await ProgramUtils.vaultProgram.account.vaultProtoConfig.fetch(
      pubkey as PublicKey
    );
  }

  static async fetchVaultAccount(
    pubkey: web3.PublicKey
  ): Promise<
    Pick<
      AsyncReturnType<typeof ProgramUtils.vaultProgram.account.vault.fetch>,
      | "protoConfig"
      | "tokenAMint"
      | "tokenBMint"
      | "tokenAAccount"
      | "tokenBAccount"
      | "lastDcaPeriod"
      | "dripAmount"
      | "bump"
    >
  > {
    return await ProgramUtils.vaultProgram.account.vault.fetch(pubkey);
  }

  static async fetchVaultPeriodAccount(
    pubkey: web3.PublicKey
  ): Promise<
    Pick<
      AsyncReturnType<
        typeof ProgramUtils.vaultProgram.account.vaultPeriod.fetch
      >,
      "vault" | "periodId" | "twap" | "dar"
    >
  > {
    return await ProgramUtils.vaultProgram.account.vaultPeriod.fetch(pubkey);
  }

  static async fetchPositionAccount(
    pubkey: web3.PublicKey
  ): Promise<
    Pick<
      AsyncReturnType<
        typeof ProgramUtils.vaultProgram.account.vaultPeriod.fetch
      >,
      | "positionAuthority"
      | "depositedTokenAAmount"
      | "withdrawnTokenBAmount"
      | "vault"
      | "depositTimestamp"
      | "dcaPeriodIdBeforeDeposit"
      | "numberOfSwaps"
      | "periodicDripAmount"
      | "isClosed"
    >
  > {
    return await ProgramUtils.vaultProgram.account.position.fetch(pubkey);
  }
}
