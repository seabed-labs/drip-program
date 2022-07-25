import { TestUtil } from "./config.util";
import { ProgramUtil } from "./program.util";
import {
  Keypair,
  PublicKey,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import { Token, u64 } from "@solana/spl-token";
import {
  amount,
  Denom,
  findAssociatedTokenAddress,
  generatePair,
  getVaultPDA,
  Granularity,
  PDA,
} from "./common.util";
import { BN } from "@project-serum/anchor";
import { TokenUtil } from "./token.util";
import { deployVault, deployVaultPeriod, depositToVault } from "./setup.util";
import { SolUtil } from "./sol.util";

export type VaultProtoConfigParams = {
  granularity: Granularity;
  tokenADripTriggerSpread: number;
  tokenBWithdrawalSpread: number;
  admin: PublicKey;
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
    numberOfSwaps: u64;
  };
}

export type DeployVaultRes = {
  vault: PublicKey;
  vaultProtoConfig: PublicKey;
  vaultPeriods: PublicKey[];
  userTokenAAccount: PublicKey;
  botTokenAAcount: PublicKey;
  vaultTreasuryTokenBAccount: PublicKey;
  vaultTokenAAccount: PublicKey;
  vaultTokenBAccount: PublicKey;
};

// TODO(Mocha): Replace the program interaction with the SDK
export class VaultUtil extends TestUtil {
  static async initVaultProtoConfig(
    vaultProtoConfigKeypair: Signer,
    vaultProtoConfig: VaultProtoConfigParams
  ): Promise<TransactionSignature> {
    const tx = await ProgramUtil.dripProgram.methods
      .initVaultProtoConfig({
        granularity: new BN(vaultProtoConfig.granularity.toString()),
        tokenADripTriggerSpread: vaultProtoConfig.tokenADripTriggerSpread,
        tokenBWithdrawalSpread: vaultProtoConfig.tokenBWithdrawalSpread,
        admin: vaultProtoConfig.admin,
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
        numberOfSwaps: input.params.numberOfSwaps,
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

  static async dripSPLTokenSwap(
    user: Keypair | Signer,
    dripTriggerFeeTokenAAccount: PublicKey,
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
      .dripSplTokenSwap()
      .accounts({
        dripTriggerSource: user.publicKey.toBase58(),
        dripTriggerFeeTokenAAccount: dripTriggerFeeTokenAAccount.toBase58(),
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
  }

  /*
    Deploy Vault Proto Config if not provided
    Create token accounts
    Deploy Vault
    Deposit into vault
    Create Vault Periods
   */
  static async deployVault({
    tokenA,
    tokenB,
    vaultProtoConfig,
    whitelistedSwaps,
    tokenOwnerKeypair,
    adminKeypair = generatePair(),
    botKeypair = generatePair(),
    userKeypair = generatePair(),
    vaultPeriodIndex = 10,
  }: {
    tokenA: Token;
    tokenB: Token;
    tokenOwnerKeypair: Keypair;
    adminKeypair?: Keypair;
    botKeypair?: Keypair;
    userKeypair?: Keypair;
    vaultProtoConfig?: PublicKey;
    whitelistedSwaps?: PublicKey[];
    vaultPeriodIndex?: number;
  }): Promise<DeployVaultRes> {
    await Promise.all([
      SolUtil.fundAccount(adminKeypair.publicKey, SolUtil.solToLamports(0.1)),
      SolUtil.fundAccount(userKeypair.publicKey, SolUtil.solToLamports(0.1)),
      SolUtil.fundAccount(
        tokenOwnerKeypair.publicKey,
        SolUtil.solToLamports(0.1)
      ),
      SolUtil.fundAccount(botKeypair.publicKey, SolUtil.solToLamports(0.1)),
    ]);

    const mintAmount = await TokenUtil.scaleAmount(
      amount(2, Denom.Thousand),
      tokenA
    );
    const userTokenAAccount = await tokenA.createAssociatedTokenAccount(
      userKeypair.publicKey
    );
    await tokenA.mintTo(userTokenAAccount, tokenOwnerKeypair, [], mintAmount);

    const vaultTreasuryTokenBAccount = await TokenUtil.createTokenAccount(
      tokenB,
      adminKeypair.publicKey
    );
    const botTokenAAcount = await tokenA.createAssociatedTokenAccount(
      botKeypair.publicKey
    );

    if (!vaultProtoConfig) {
      const vaultProtoConfigKeypair = generatePair();
      await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
        granularity: 1,
        triggerDCASpread: 10,
        baseWithdrawalSpread: 10,
        admin: adminKeypair.publicKey,
      });
      vaultProtoConfig = vaultProtoConfigKeypair.publicKey;
    }

    const vaultPDA = await getVaultPDA(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultProtoConfig
    );
    const [vaultTokenAAccount, vaultTokenBAccount] = await Promise.all([
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
    ]);

    await VaultUtil.initVault(
      vaultPDA.publicKey,
      vaultProtoConfig,
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTokenAAccount,
      vaultTokenBAccount,
      vaultTreasuryTokenBAccount,
      whitelistedSwaps
    );

    const vaultPeriods = (
      await Promise.all(
        [...Array(vaultPeriodIndex).keys()].map((i) =>
          deployVaultPeriod(
            vaultProtoConfig,
            vaultPDA.publicKey,
            tokenA.publicKey,
            tokenB.publicKey,
            i
          )
        )
      )
    ).map((vaultPeriodPDA: PDA) => {
      return vaultPeriodPDA.publicKey;
    });

    const depositAmount = await TokenUtil.scaleAmount(
      amount(1, Denom.Thousand),
      tokenA
    );

    await depositToVault(
      userKeypair,
      tokenA,
      depositAmount,
      new u64(4),
      vaultPDA.publicKey,
      vaultPeriods[4],
      userTokenAAccount
    );

    return {
      vault: vaultPDA.publicKey,
      vaultProtoConfig,
      vaultPeriods,
      userTokenAAccount,
      botTokenAAcount,
      vaultTreasuryTokenBAccount,
      vaultTokenAAccount,
      vaultTokenBAccount,
    };
  }
}
