import { TestUtil } from "./config";
import { ProgramUtil } from "./Program.util";
import {
  Keypair,
  PublicKey,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import { u64 } from "@solana/spl-token";
import { Granularity } from "./common.util";
import { BN } from "@project-serum/anchor";

export type VaultProtoConfig = {
  granularity: Granularity;
  triggerDCASpread: number;
  baseWithdrawalSpread: number;
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
  ): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .initVaultProtoConfig({
        granularity: new BN(vaultProtoConfig.granularity.toString()),
        triggerDcaSpread: vaultProtoConfig.triggerDCASpread,
        baseWithdrawalSpread: vaultProtoConfig.baseWithdrawalSpread,
      })
      .accounts({
        vaultProtoConfig: vaultProtoConfigKeypair.publicKey,
        creator: this.provider.wallet.publicKey,
        systemProgram: ProgramUtil.systemProgram.programId,
      })
      .transaction();
    return await this.provider.sendAndConfirm(tx, [vaultProtoConfigKeypair]);
  }

  static async initVault(
    vaultPubkey: PublicKey,
    vaultProtoConfigAccount: PublicKey,
    tokenAMint: PublicKey,
    tokenBMint: PublicKey,
    tokenA_ATA: PublicKey,
    tokenB_ATA: PublicKey,
    treasuryTokenBAccount: PublicKey,
    whitelistedSwaps: PublicKey[] | null | undefined,
    programs?: {
      systemProgram?: PublicKey;
      tokenProgram?: PublicKey;
      associatedTokenProgram?: PublicKey;
      rent?: PublicKey;
    }
  ): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .initVault({
        whitelistedSwaps: whitelistedSwaps ? whitelistedSwaps : [],
      })
      .accounts({
        vault: vaultPubkey.toBase58(),
        vaultProtoConfig: vaultProtoConfigAccount.toBase58(),
        tokenAMint: tokenAMint.toBase58(),
        tokenBMint: tokenBMint.toBase58(),
        tokenAAccount: tokenA_ATA.toBase58(),
        tokenBAccount: tokenB_ATA.toBase58(),
        treasuryTokenBAccount: treasuryTokenBAccount.toBase58(),
        creator: this.provider.wallet.publicKey.toBase58(),
        systemProgram:
          programs?.systemProgram?.toBase58() ??
          ProgramUtil.systemProgram.programId.toBase58(),
        tokenProgram:
          programs?.tokenProgram?.toBase58() ??
          ProgramUtil.tokenProgram.programId.toBase58(),
        associatedTokenProgram:
          programs?.associatedTokenProgram?.toBase58() ??
          ProgramUtil.associatedTokenProgram.programId.toBase58(),
        rent:
          programs?.rent?.toBase58() ??
          ProgramUtil.rentProgram.programId.toBase58(),
      })
      .transaction();
    return await this.provider.sendAndConfirm(tx, undefined);
  }

  static async initVaultPeriod(
    vault: PublicKey,
    vaultPeriod: PublicKey,
    vaultProtoConfig: PublicKey,
    tokenAMint: PublicKey,
    tokenBMint: PublicKey,
    periodId: number
  ): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .initVaultPeriod({
        periodId: new u64(periodId),
      })
      .accounts({
        vault: vault.toBase58(),
        vaultPeriod: vaultPeriod.toBase58(),
        vaultProtoConfig: vaultProtoConfig.toBase58(),
        tokenAMint: tokenAMint.toBase58(),
        tokenBMint: tokenBMint.toBase58(),
        creator: this.provider.wallet.publicKey.toBase58(),
        systemProgram: ProgramUtil.systemProgram.programId.toBase58(),
      })
      .transaction();
    return await this.provider.sendAndConfirm(tx, undefined);
  }

  static async deposit(input: DepositTxParams): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .deposit({
        tokenADepositAmount: input.params.tokenADepositAmount,
        dcaCycles: input.params.dcaCycles,
      })
      .accounts({
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
      })
      .transaction();
    return await this.provider.sendAndConfirm(tx, [
      input.signers.userPositionNftMint,
      input.signers.depositor,
    ]);
  }

  static async triggerDCA(
    user: Keypair | Signer,
    dcaTriggerFeeTokenAAccount: PublicKey,
    vault: PublicKey,
    vaultProtoConfig: PublicKey,
    vaultTokenAAccount: PublicKey,
    vaultTokenBAccount: PublicKey,
    lastVaultPeriod: PublicKey,
    currentVaultPeriod: PublicKey,
    tokenAMint: PublicKey,
    tokenBMint: PublicKey,
    swapTokenMint: PublicKey,
    swapTokenAAccount: PublicKey,
    swapTokenBAccount: PublicKey,
    swapFeeAccount: PublicKey,
    swapAuthority: PublicKey,
    swap: PublicKey
  ): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .triggerDca()
      .accounts({
        dcaTriggerSource: user.publicKey.toBase58(),
        dcaTriggerFeeTokenAAccount: dcaTriggerFeeTokenAAccount.toBase58(),
        vault: vault.toBase58(),
        vaultProtoConfig: vaultProtoConfig.toBase58(),
        lastVaultPeriod: lastVaultPeriod.toBase58(),
        currentVaultPeriod: currentVaultPeriod.toBase58(),
        swapTokenMint: swapTokenMint.toBase58(),
        tokenAMint: tokenAMint.toBase58(),
        tokenBMint: tokenBMint.toBase58(),
        vaultTokenAAccount: vaultTokenAAccount.toBase58(),
        vaultTokenBAccount: vaultTokenBAccount.toBase58(),
        swapTokenAAccount: swapTokenAAccount.toBase58(),
        swapTokenBAccount: swapTokenBAccount.toBase58(),
        swapFeeAccount: swapFeeAccount.toBase58(),
        swap: swap.toBase58(),
        swapAuthority: swapAuthority.toBase58(),
        tokenSwapProgram: ProgramUtil.tokenSwapProgram.programId.toBase58(),
        tokenProgram: ProgramUtil.tokenProgram.programId.toBase58(),
        associatedTokenProgram:
          ProgramUtil.associatedTokenProgram.programId.toBase58(),
        systemProgram: ProgramUtil.systemProgram.programId.toBase58(),
        rent: ProgramUtil.rentProgram.programId.toBase58(),
      })
      .transaction();
    return await this.provider.sendAndConfirm(tx, [user]);
    // return await ProgramUtil.dripProgram.rpc.triggerDca({
    //   accounts,
    //   signers: [user],
    // });
  }

  static async withdrawB(
    withdrawer: Keypair | Signer,
    vault: PublicKey,
    vaultProtoConfig: PublicKey,
    userPosition: PublicKey,
    userPositionNftAccount: PublicKey,
    userPositionNftMint: PublicKey,
    vaultTokenBAccount: PublicKey,
    vaultTreasuryTokenBAccount: PublicKey,
    vaultPeriodI: PublicKey,
    vaultPeriodJ: PublicKey,
    tokenBMint: PublicKey,
    userTokenBAccount: PublicKey
  ): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .withdrawB()
      .accounts({
        withdrawer: withdrawer.publicKey.toBase58(),
        vault: vault.toBase58(),
        vaultProtoConfig: vaultProtoConfig.toBase58(),
        vaultPeriodI: vaultPeriodI.toBase58(),
        vaultPeriodJ: vaultPeriodJ.toBase58(),
        userPosition: userPosition.toBase58(),
        userPositionNftAccount: userPositionNftAccount.toBase58(),
        userPositionNftMint: userPositionNftMint.toBase58(),
        vaultTokenBAccount: vaultTokenBAccount.toBase58(),
        tokenBMint: tokenBMint.toBase58(),
        vaultTreasuryTokenBAccount: vaultTreasuryTokenBAccount.toBase58(),
        userTokenBAccount: userTokenBAccount.toBase58(),
        tokenProgram: ProgramUtil.tokenProgram.programId.toBase58(),
        associatedTokenProgram:
          ProgramUtil.associatedTokenProgram.programId.toBase58(),
      })
      .transaction();
    return this.provider.sendAndConfirm(tx, [withdrawer]);
    // // console.log(JSON.stringify(accounts, undefined, 2));
    // return await ProgramUtil.dripProgram.rpc.withdrawB({
    //   accounts: accounts,
    //   signers: [withdrawer],
    // });
  }

  static async closePosition(
    withdrawer: Keypair | Signer,
    vault: PublicKey,
    vaultProtoConfig: PublicKey,
    userPosition: PublicKey,
    vaultPeriodI: PublicKey,
    vaultPeriodJ: PublicKey,
    vaultPeriodUserExpiry: PublicKey,
    vaultTokenAAccount: PublicKey,
    vaultTokenBAccount: PublicKey,
    vaultTreasuryTokenBAccount: PublicKey,
    userTokenAAccount: PublicKey,
    userTokenBAccount: PublicKey,
    userPositionNftAccount: PublicKey,
    userPositionNftMint: PublicKey,
    tokenAMint: PublicKey,
    tokenBMint: PublicKey
  ): Promise<TransactionSignature> {
    const accounts = {};
    const tx = await ProgramUtil.dripProgram.methods
      .closePosition()
      .accounts({
        vault: vault.toBase58(),
        vaultProtoConfig: vaultProtoConfig.toBase58(),
        vaultPeriodI: vaultPeriodI.toBase58(),
        vaultPeriodJ: vaultPeriodJ.toBase58(),
        vaultPeriodUserExpiry: vaultPeriodUserExpiry.toBase58(),
        userPosition: userPosition.toBase58(),
        vaultTokenAAccount: vaultTokenAAccount.toBase58(),
        vaultTokenBAccount: vaultTokenBAccount.toBase58(),
        vaultTreasuryTokenBAccount: vaultTreasuryTokenBAccount.toBase58(),
        userTokenAAccount: userTokenAAccount.toBase58(),
        userTokenBAccount: userTokenBAccount.toBase58(),
        userPositionNftAccount: userPositionNftAccount.toBase58(),
        userPositionNftMint: userPositionNftMint.toBase58(),
        tokenAMint: tokenAMint.toBase58(),
        tokenBMint: tokenBMint.toBase58(),
        withdrawer: withdrawer.publicKey.toBase58(),
        tokenProgram: ProgramUtil.tokenProgram.programId.toBase58(),
        systemProgram: ProgramUtil.systemProgram.programId.toBase58(),
      })
      .transaction();
    return this.provider.sendAndConfirm(tx, [withdrawer]);
    // console.log(JSON.stringify(accounts, undefined, 2));
    // return await ProgramUtil.dripProgram.rpc.closePosition({
    //   accounts,
    //   signers: [withdrawer],
    // });
  }
}
