import "should";
import {
  findAssociatedTokenAddress,
  generatePair,
  getVaultPDA,
  Granularity,
} from "../../utils/common.util";
import { SolUtil } from "../../utils/sol.util";
import { DripUtil } from "../../utils/drip.util";
import { TokenUtil } from "../../utils/token.util";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { Token } from "@solana/spl-token";
import { AccountUtil } from "../../utils/account.util";
import { ProgramUtil } from "../../utils/program.util";
import { TestUtil } from "../../utils/config.util";

describe("#setVaultSwapWhitelist", testSetVaultSwapWhitelist);

export function testSetVaultSwapWhitelist() {
  let treasuryTokenBAccount: PublicKey;
  let adminKeypair: Keypair;

  let vaultProtoConfig: PublicKey;
  let vault: PublicKey;
  let vaultTokenAAccount: PublicKey;
  let vaultTokenBAccount: PublicKey;

  let tokenA: Token;
  let tokenB: Token;

  let makeInitVaultTx: (
    creatorPubkey: PublicKey,
    whitelistedSwaps: PublicKey[]
  ) => Promise<Transaction>;

  beforeEach(async () => {
    adminKeypair = generatePair();
    const vaultProtoConfigKeypair = generatePair();
    const treasuryOwner = generatePair();

    await Promise.all([
      SolUtil.fundAccount(adminKeypair.publicKey, SolUtil.solToLamports(0.1)),
      DripUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
        granularity: Granularity.DAILY,
        tokenADripTriggerSpread: 5,
        tokenBWithdrawalSpread: 5,
        tokenBReferralSpread: 10,
        admin: adminKeypair.publicKey,
      }),
    ]);

    vaultProtoConfig = vaultProtoConfigKeypair.publicKey;

    [tokenA, tokenB] = await Promise.all([
      TokenUtil.createMockUSDCMint(),
      TokenUtil.createMockBTCMint(),
    ]);

    treasuryTokenBAccount = await TokenUtil.createTokenAccount(
      tokenB,
      treasuryOwner.publicKey
    );

    const vaultPda = await getVaultPDA(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultProtoConfig
    );

    vault = vaultPda.publicKey;

    [vaultTokenAAccount, vaultTokenBAccount] = await Promise.all([
      findAssociatedTokenAddress(vault, tokenA.publicKey),
      findAssociatedTokenAddress(vault, tokenB.publicKey),
    ]);

    // TODO(Mocha): we should migrate our vault utils to this pattern
    makeInitVaultTx = async (
      creatorPubkey: PublicKey,
      whitelistedSwaps: PublicKey[]
    ) =>
      await ProgramUtil.dripProgram.methods
        .initVault({
          whitelistedSwaps,
          maxSlippageBps: 1_000,
        })
        .accounts({
          creator: creatorPubkey,
          vault: vault.toBase58(),
          vaultProtoConfig: vaultProtoConfigKeypair.publicKey.toBase58(),
          tokenAMint: tokenA.publicKey.toBase58(),
          tokenBMint: tokenB.publicKey.toBase58(),
          tokenAAccount: vaultTokenAAccount.toBase58(),
          tokenBAccount: vaultTokenBAccount.toBase58(),
          treasuryTokenBAccount: treasuryTokenBAccount.toBase58(),
          systemProgram: ProgramUtil.systemProgram.programId.toBase58(),
          tokenProgram: ProgramUtil.tokenProgram.programId.toBase58(),
          associatedTokenProgram:
            ProgramUtil.associatedTokenProgram.programId.toBase58(),
          rent: ProgramUtil.rentProgram.programId.toBase58(),
        })
        .transaction();
  });

  it("should allow the admin to update the vault's whitelisted swaps with one swap when they are initially empty", async () => {
    const blockhash = await TestUtil.provider.connection.getLatestBlockhash();
    const txId = await TestUtil.provider.connection.sendTransaction(
      await makeInitVaultTx(adminKeypair.publicKey, []),
      [adminKeypair]
    );
    await TestUtil.provider.connection.confirmTransaction(
      {
        signature: txId,
        ...blockhash,
      },
      "confirmed"
    );
    const vaultAccountBefore = await AccountUtil.fetchVaultAccount(vault);
    vaultAccountBefore.whitelistedSwaps.length.should.equal(5);
    vaultAccountBefore.whitelistedSwaps.forEach((whitelistedSwap) => {
      whitelistedSwap.toString().should.equal(PublicKey.default.toString());
    });
    vaultAccountBefore.limitSwaps.should.equal(false);

    const newWhitelistedSwaps = [generatePair().publicKey];
    await DripUtil.setVaultSwapWhitelist(
      vault,
      vaultProtoConfig,
      adminKeypair,
      {
        whitelistedSwaps: newWhitelistedSwaps,
      }
    );

    const vaultAccountAfter = await AccountUtil.fetchVaultAccount(vault);
    vaultAccountAfter.whitelistedSwaps.length.should.equal(5);
    vaultAccountAfter.whitelistedSwaps[0]
      .toString()
      .should.equal(newWhitelistedSwaps[0].toString());
    vaultAccountAfter.whitelistedSwaps
      .slice(1)
      .forEach((newWhitelistedSwap) => {
        newWhitelistedSwap
          .toString()
          .should.equal(PublicKey.default.toString());
      });
    vaultAccountAfter.limitSwaps.should.equal(true);

    vaultAccountAfter.protoConfig
      .equals(vaultAccountBefore.protoConfig)
      .should.be.true();
    vaultAccountAfter.tokenAMint
      .equals(vaultAccountBefore.tokenAMint)
      .should.be.true();
    vaultAccountAfter.tokenBMint
      .equals(vaultAccountBefore.tokenBMint)
      .should.be.true();
    vaultAccountAfter.tokenAAccount
      .equals(vaultAccountBefore.tokenAAccount)
      .should.be.true();
    vaultAccountAfter.tokenBAccount
      .equals(vaultAccountBefore.tokenBAccount)
      .should.be.true();
    vaultAccountAfter.treasuryTokenBAccount
      .equals(vaultAccountBefore.treasuryTokenBAccount)
      .should.be.true();
    vaultAccountAfter.lastDripPeriod
      .eq(vaultAccountBefore.lastDripPeriod)
      .should.be.true();
    vaultAccountAfter.dripAmount
      .eq(vaultAccountBefore.dripAmount)
      .should.be.true();
    vaultAccountAfter.dripActivationTimestamp
      .eq(vaultAccountBefore.dripActivationTimestamp)
      .should.be.true();
    vaultAccountAfter.bump.should.equal(vaultAccountBefore.bump);
    vaultAccountAfter.maxSlippageBps.should.equal(
      vaultAccountBefore.maxSlippageBps
    );
  });

  it("should allow the admin to update the vault's whitelisted swaps with one swap and override existing swaps", async () => {
    const originalWhitelist = [generatePair().publicKey];

    const blockhash = await TestUtil.provider.connection.getLatestBlockhash();
    const txId = await TestUtil.provider.connection.sendTransaction(
      await makeInitVaultTx(adminKeypair.publicKey, originalWhitelist),
      [adminKeypair]
    );
    await TestUtil.provider.connection.confirmTransaction(
      {
        signature: txId,
        ...blockhash,
      },
      "confirmed"
    );

    const vaultAccountBefore = await AccountUtil.fetchVaultAccount(vault);
    vaultAccountBefore.whitelistedSwaps.length.should.equal(5);
    vaultAccountBefore.whitelistedSwaps[0]
      .equals(originalWhitelist[0])
      .should.be.true();
    vaultAccountBefore.whitelistedSwaps.slice(1).forEach((whitelistedSwap) => {
      whitelistedSwap.toString().should.equal(PublicKey.default.toString());
    });
    vaultAccountBefore.limitSwaps.should.equal(true);

    const newWhitelistedSwaps = [generatePair().publicKey];
    await DripUtil.setVaultSwapWhitelist(
      vault,
      vaultProtoConfig,
      adminKeypair,
      {
        whitelistedSwaps: newWhitelistedSwaps,
      }
    );

    const vaultAccountAfter = await AccountUtil.fetchVaultAccount(vault);
    vaultAccountAfter.whitelistedSwaps.length.should.equal(5);
    vaultAccountAfter.whitelistedSwaps[0]
      .toString()
      .should.equal(newWhitelistedSwaps[0].toString());
    vaultAccountAfter.whitelistedSwaps
      .slice(1)
      .forEach((newWhitelistedSwap) => {
        newWhitelistedSwap
          .toString()
          .should.equal(PublicKey.default.toString());
      });
    vaultAccountAfter.limitSwaps.should.equal(true);

    vaultAccountAfter.protoConfig
      .equals(vaultAccountBefore.protoConfig)
      .should.be.true();
    vaultAccountAfter.tokenAMint
      .equals(vaultAccountBefore.tokenAMint)
      .should.be.true();
    vaultAccountAfter.tokenBMint
      .equals(vaultAccountBefore.tokenBMint)
      .should.be.true();
    vaultAccountAfter.tokenAAccount
      .equals(vaultAccountBefore.tokenAAccount)
      .should.be.true();
    vaultAccountAfter.tokenBAccount
      .equals(vaultAccountBefore.tokenBAccount)
      .should.be.true();
    vaultAccountAfter.treasuryTokenBAccount
      .equals(vaultAccountBefore.treasuryTokenBAccount)
      .should.be.true();
    vaultAccountAfter.lastDripPeriod
      .eq(vaultAccountBefore.lastDripPeriod)
      .should.be.true();
    vaultAccountAfter.dripAmount
      .eq(vaultAccountBefore.dripAmount)
      .should.be.true();
    vaultAccountAfter.dripActivationTimestamp
      .eq(vaultAccountBefore.dripActivationTimestamp)
      .should.be.true();
    vaultAccountAfter.bump.should.equal(vaultAccountBefore.bump);
    vaultAccountAfter.maxSlippageBps.should.equal(
      vaultAccountBefore.maxSlippageBps
    );
  });

  it("should allow the admin to update the vault's whitelisted swaps to an empty list and set limitSwaps to false", async () => {
    const originalWhitelist = [generatePair().publicKey];

    const blockhash = await TestUtil.provider.connection.getLatestBlockhash();
    const txId = await TestUtil.provider.connection.sendTransaction(
      await makeInitVaultTx(adminKeypair.publicKey, originalWhitelist),
      [adminKeypair]
    );
    await TestUtil.provider.connection.confirmTransaction(
      {
        signature: txId,
        ...blockhash,
      },
      "confirmed"
    );

    const vaultAccountBefore = await AccountUtil.fetchVaultAccount(vault);
    vaultAccountBefore.whitelistedSwaps.length.should.equal(5);
    vaultAccountBefore.whitelistedSwaps[0]
      .equals(originalWhitelist[0])
      .should.be.true();
    vaultAccountBefore.whitelistedSwaps.slice(1).forEach((whitelistedSwap) => {
      whitelistedSwap.toString().should.equal(PublicKey.default.toString());
    });
    vaultAccountBefore.limitSwaps.should.equal(true);

    await DripUtil.setVaultSwapWhitelist(
      vault,
      vaultProtoConfig,
      adminKeypair,
      {
        whitelistedSwaps: undefined,
      }
    );

    const vaultAccountAfter = await AccountUtil.fetchVaultAccount(vault);
    vaultAccountAfter.whitelistedSwaps.length.should.equal(5);
    vaultAccountAfter.whitelistedSwaps.forEach((newWhitelistedSwap) => {
      newWhitelistedSwap.toString().should.equal(PublicKey.default.toString());
    });
    vaultAccountAfter.limitSwaps.should.equal(false);

    vaultAccountAfter.protoConfig
      .equals(vaultAccountBefore.protoConfig)
      .should.be.true();
    vaultAccountAfter.tokenAMint
      .equals(vaultAccountBefore.tokenAMint)
      .should.be.true();
    vaultAccountAfter.tokenBMint
      .equals(vaultAccountBefore.tokenBMint)
      .should.be.true();
    vaultAccountAfter.tokenAAccount
      .equals(vaultAccountBefore.tokenAAccount)
      .should.be.true();
    vaultAccountAfter.tokenBAccount
      .equals(vaultAccountBefore.tokenBAccount)
      .should.be.true();
    vaultAccountAfter.treasuryTokenBAccount
      .equals(vaultAccountBefore.treasuryTokenBAccount)
      .should.be.true();
    vaultAccountAfter.lastDripPeriod
      .eq(vaultAccountBefore.lastDripPeriod)
      .should.be.true();
    vaultAccountAfter.dripAmount
      .eq(vaultAccountBefore.dripAmount)
      .should.be.true();
    vaultAccountAfter.dripActivationTimestamp
      .eq(vaultAccountBefore.dripActivationTimestamp)
      .should.be.true();
    vaultAccountAfter.bump.should.equal(vaultAccountBefore.bump);
    vaultAccountAfter.maxSlippageBps.should.equal(
      vaultAccountBefore.maxSlippageBps
    );
  });

  it("should not allow random keypair to update the vault's whitelisted swaps", async () => {
    const blockhash = await TestUtil.provider.connection.getLatestBlockhash();
    const txId = await TestUtil.provider.connection.sendTransaction(
      await makeInitVaultTx(adminKeypair.publicKey, []),
      [adminKeypair]
    );
    await TestUtil.provider.connection.confirmTransaction(
      {
        signature: txId,
        ...blockhash,
      },
      "confirmed"
    );
    const vaultAccountBefore = await AccountUtil.fetchVaultAccount(vault);
    vaultAccountBefore.whitelistedSwaps.length.should.equal(5);
    vaultAccountBefore.whitelistedSwaps.forEach((whitelistedSwap) => {
      whitelistedSwap.toString().should.equal(PublicKey.default.toString());
    });
    vaultAccountBefore.limitSwaps.should.equal(false);

    const newWhitelistedSwaps = [generatePair().publicKey];
    await DripUtil.setVaultSwapWhitelist(vault, vaultProtoConfig, undefined, {
      whitelistedSwaps: newWhitelistedSwaps,
    }).should.be.rejectedWith(/0x1785/);

    const vaultAccountAfter = await AccountUtil.fetchVaultAccount(vault);
    vaultAccountAfter.should.deepEqual(vaultAccountBefore);
  });
}
