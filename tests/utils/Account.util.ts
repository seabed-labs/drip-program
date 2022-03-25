import { web3 } from "@project-serum/anchor";
import { TestUtil } from "./config";
import { ProgramUtil } from "./Program.util";
import { AccountInfo, PublicKey } from "@solana/web3.js";
import { AsyncReturnType } from "./common.util";

export class AccountUtil extends TestUtil {
  static async fetchAccountInfo(
    pubkey: PublicKey
  ): Promise<AccountInfo<unknown>> {
    return await this.provider.connection.getAccountInfo(pubkey);
  }

  static async fetchAccountData(pubkey: web3.PublicKey): Promise<Buffer> {
    const account = await this.provider.connection.getAccountInfo(pubkey);
    return account.data;
  }

  static async fetchVaultProtoConfigAccount(
    pubkey: web3.PublicKey
  ): Promise<
    Pick<
      AsyncReturnType<
        typeof ProgramUtil.vaultProgram.account.vaultProtoConfig.fetch
      >,
      "granularity" | "triggerDcaSpread" | "baseWithdrawalSpread"
    >
  > {
    return await ProgramUtil.vaultProgram.account.vaultProtoConfig.fetch(
      pubkey
    );
  }

  static async fetchVaultAccount(
    pubkey: web3.PublicKey
  ): Promise<
    Pick<
      AsyncReturnType<typeof ProgramUtil.vaultProgram.account.vault.fetch>,
      | "protoConfig"
      | "tokenAMint"
      | "tokenBMint"
      | "tokenAAccount"
      | "tokenBAccount"
      | "lastDcaPeriod"
      | "dripAmount"
      | "bump"
      | "dcaActivationTimestamp"
    >
  > {
    return await ProgramUtil.vaultProgram.account.vault.fetch(pubkey);
  }

  static async fetchVaultPeriodAccount(
    pubkey: web3.PublicKey
  ): Promise<
    Pick<
      AsyncReturnType<
        typeof ProgramUtil.vaultProgram.account.vaultPeriod.fetch
      >,
      "vault" | "periodId" | "twap" | "dar"
    >
  > {
    return await ProgramUtil.vaultProgram.account.vaultPeriod.fetch(pubkey);
  }

  static async fetchPositionAccount(
    pubkey: web3.PublicKey
  ): Promise<
    Pick<
      AsyncReturnType<typeof ProgramUtil.vaultProgram.account.position.fetch>,
      | "positionAuthority"
      | "depositedTokenAAmount"
      | "withdrawnTokenBAmount"
      | "vault"
      | "depositTimestamp"
      | "dcaPeriodIdBeforeDeposit"
      | "numberOfSwaps"
      | "periodicDripAmount"
      | "isClosed"
      | "bump"
    >
  > {
    return await ProgramUtil.vaultProgram.account.position.fetch(pubkey);
  }
}
