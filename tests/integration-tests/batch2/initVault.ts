import "should";
import { AccountUtil } from "../../utils/account.util";
import { TokenUtil } from "../../utils/token.util";
import { VaultUtil } from "../../utils/vault.util";
import { PublicKey, Keypair, Transaction } from "@solana/web3.js";
import { Token } from "@solana/spl-token";
import {
  findAssociatedTokenAddress,
  generatePair,
  generatePairs,
  getVaultPDA,
  Granularity,
  PDA,
} from "../../utils/common.util";
import { SolUtil } from "../../utils/sol.util";
import { initLog } from "../../utils/log.util";
import { TestUtil } from "../../utils/config.util";
import { ProgramUtil } from "../../utils/program.util";
import { BN } from "@project-serum/anchor";

describe("#initVault", testInitVault);

export function testInitVault() {
  initLog();

  let vaultProtoConfigAccount: PublicKey;
  let tokenA: Token;
  let tokenB: Token;
  let treasuryTokenBAccount: PublicKey;

  beforeEach(async () => {
    const vaultProtoConfigKeypair = generatePair();
    const treasuryOwner = generatePair();
    await Promise.all([
      SolUtil.fundAccount(treasuryOwner.publicKey, SolUtil.solToLamports(0.1)),
      VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
        granularity: Granularity.DAILY,
        tokenADripTriggerSpread: 5,
        tokenBWithdrawalSpread: 5,
        tokenBReferralSpread: 10,
        admin: TestUtil.provider.wallet.publicKey,
      }),
    ]);

    vaultProtoConfigAccount = vaultProtoConfigKeypair.publicKey;

    [tokenA, tokenB] = await Promise.all([
      TokenUtil.createMockUSDCMint(),
      TokenUtil.createMockBTCMint(),
    ]);
    treasuryTokenBAccount = await TokenUtil.createTokenAccount(
      tokenB,
      treasuryOwner.publicKey
    );
  });

  it("initializes the vault account correctly", async () => {
    const vaultPDA = await getVaultPDA(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultProtoConfigAccount
    );

    const [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
    ]);

    await VaultUtil.initVault(
      vaultPDA.publicKey,
      vaultProtoConfigAccount,
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTokenA_ATA,
      vaultTokenB_ATA,
      treasuryTokenBAccount,
      undefined
    );

    const vaultAccount = await AccountUtil.fetchVaultAccount(
      vaultPDA.publicKey
    );
    const [vaultTokenAAccount, vaultTokenBAccount] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(vaultTokenA_ATA),
      TokenUtil.fetchTokenAccountInfo(vaultTokenB_ATA),
    ]);

    // TODO(matcha): Somehow test vaultAccount.dripActivationTimestamp
    vaultAccount.lastDripPeriod.toString().should.equal("0");
    vaultAccount.dripAmount.toString().should.equal("0");

    vaultAccount.protoConfig
      .toString()
      .should.equal(vaultProtoConfigAccount.toString());

    vaultAccount.tokenAMint
      .toString()
      .should.equal(tokenA.publicKey.toString());
    vaultAccount.tokenBMint
      .toString()
      .should.equal(tokenB.publicKey.toString());

    vaultAccount.tokenAAccount
      .toString()
      .should.equal(vaultTokenA_ATA.toString());
    vaultAccount.tokenBAccount
      .toString()
      .should.equal(vaultTokenB_ATA.toString());

    vaultTokenAAccount.mint
      .toString()
      .should.equal(tokenA.publicKey.toString());
    vaultTokenBAccount.mint
      .toString()
      .should.equal(tokenB.publicKey.toString());

    vaultTokenAAccount.owner
      .toString()
      .should.equal(vaultPDA.publicKey.toString());
    vaultTokenBAccount.owner
      .toString()
      .should.equal(vaultPDA.publicKey.toString());

    vaultAccount.bump.toString().should.equal(vaultPDA.bump.toString());
  });

  it("initializes the vault account with 1 swap", async () => {
    const whitelistedSwaps = generatePairs(1).map((pair) => pair.publicKey);
    const vaultPDA = await getVaultPDA(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultProtoConfigAccount
    );

    const [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
    ]);

    await VaultUtil.initVault(
      vaultPDA.publicKey,
      vaultProtoConfigAccount,
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTokenA_ATA,
      vaultTokenB_ATA,
      treasuryTokenBAccount,
      {
        whitelistedSwaps,
        maxSlippageBps: 1000,
      }
    );

    const vaultAccount = await AccountUtil.fetchVaultAccount(
      vaultPDA.publicKey
    );

    whitelistedSwaps.forEach((swap) => {
      vaultAccount.whitelistedSwaps
        .findIndex((vaultSwap) => vaultSwap.toString() === swap.toString())
        .should.not.equal(-1);
    });
  });

  it("initializes the vault account with 5 whitelistedSwaps", async () => {
    const whitelistedSwaps = generatePairs(5).map((pair) => pair.publicKey);
    const vaultPDA = await getVaultPDA(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultProtoConfigAccount
    );

    const [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
    ]);

    await VaultUtil.initVault(
      vaultPDA.publicKey,
      vaultProtoConfigAccount,
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTokenA_ATA,
      vaultTokenB_ATA,
      treasuryTokenBAccount,
      {
        whitelistedSwaps,
        maxSlippageBps: 1000,
      }
    );

    const vaultAccount = await AccountUtil.fetchVaultAccount(
      vaultPDA.publicKey
    );

    whitelistedSwaps.forEach((swap) => {
      vaultAccount.whitelistedSwaps
        .findIndex((vaultSwap) => vaultSwap.toString() === swap.toString())
        .should.not.equal(-1);
    });
  });

  it("should fail to initialize the vault account with 6 whitelistedSwaps", async () => {
    const whitelistedSwaps = generatePairs(6).map((pair) => pair.publicKey);
    const vaultPDA = await getVaultPDA(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultProtoConfigAccount
    );

    const [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
    ]);

    await VaultUtil.initVault(
      vaultPDA.publicKey,
      vaultProtoConfigAccount,
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTokenA_ATA,
      vaultTokenB_ATA,
      treasuryTokenBAccount,
      {
        whitelistedSwaps,
      }
    ).should.be.rejectedWith(/0x1779/);
  });

  it("should fail to initialize when vault PDA is generated with invalid seeds", async () => {
    // NOTE: swapped tokenA and tokenB
    const vaultPDA = await getVaultPDA(
      tokenB.publicKey,
      tokenA.publicKey,
      vaultProtoConfigAccount
    );

    const [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
    ]);

    await VaultUtil.initVault(
      vaultPDA.publicKey,
      vaultProtoConfigAccount,
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTokenA_ATA,
      vaultTokenB_ATA,
      treasuryTokenBAccount,
      undefined
    ).should.rejectedWith(
      /Cross-program invocation with unauthorized signer or writable account/
    );
  });

  it("should fail to initialize when vault PDA is on ed25519 curve", async () => {
    const vaultPDAPublicKey = generatePair().publicKey;

    const [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      findAssociatedTokenAddress(vaultPDAPublicKey, tokenA.publicKey),
      findAssociatedTokenAddress(vaultPDAPublicKey, tokenB.publicKey),
    ]);

    await VaultUtil.initVault(
      vaultPDAPublicKey,
      vaultProtoConfigAccount,
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTokenA_ATA,
      vaultTokenB_ATA,
      treasuryTokenBAccount,
      undefined
    ).should.rejectedWith(
      /Cross-program invocation with unauthorized signer or writable account/
    );
  });

  it("should fail to initialize when token accounts are not ATA's", async () => {
    const vaultPDA = await getVaultPDA(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultProtoConfigAccount
    );

    const [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      generatePair().publicKey,
      generatePair().publicKey,
    ]);

    await VaultUtil.initVault(
      vaultPDA.publicKey,
      vaultProtoConfigAccount,
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTokenA_ATA,
      vaultTokenB_ATA,
      treasuryTokenBAccount,
      undefined
    ).should.rejectedWith(/An account required by the instruction is missing/);
  });

  context("admin", () => {
    let whitelistedSwaps: PublicKey[];
    let vaultProtoConfigKeypair: Keypair;
    let adminKeypair: Keypair;
    let vaultPDA: PDA;
    let vaultTokenAAta: PublicKey, vaultTokenBAta: PublicKey;
    let treasuryTokenBAccount: PublicKey;
    let makeInitVaultTx: (creatorPubkey: PublicKey) => Promise<Transaction>;
    let makeInitVaultProtoConfigTx: (
      adminPubkey: PublicKey
    ) => Promise<Transaction>;

    beforeEach(async () => {
      whitelistedSwaps = generatePairs(5).map((pair) => pair.publicKey);
      vaultProtoConfigKeypair = generatePair();
      adminKeypair = generatePair();
      await SolUtil.fundAccount(
        adminKeypair.publicKey,
        SolUtil.solToLamports(1)
      );
      vaultPDA = await getVaultPDA(
        tokenA.publicKey,
        tokenB.publicKey,
        vaultProtoConfigKeypair.publicKey
      );
      [vaultTokenAAta, vaultTokenBAta] = await Promise.all([
        findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
        findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
      ]);
      treasuryTokenBAccount = await tokenB.createAccount(
        adminKeypair.publicKey
      );

      makeInitVaultTx = async (creatorPubkey: PublicKey) =>
        await ProgramUtil.dripProgram.methods
          .initVault({
            whitelistedSwaps,
            maxSlippageBps: 1_000,
          })
          .accounts({
            vault: vaultPDA.publicKey.toBase58(),
            vaultProtoConfig: vaultProtoConfigKeypair.publicKey.toBase58(),
            tokenAMint: tokenA.publicKey.toBase58(),
            tokenBMint: tokenB.publicKey.toBase58(),
            tokenAAccount: vaultTokenAAta.toBase58(),
            tokenBAccount: vaultTokenBAta.toBase58(),
            treasuryTokenBAccount: treasuryTokenBAccount.toBase58(),
            creator: creatorPubkey,
            systemProgram: ProgramUtil.systemProgram.programId.toBase58(),
            tokenProgram: ProgramUtil.tokenProgram.programId.toBase58(),
            associatedTokenProgram:
              ProgramUtil.associatedTokenProgram.programId.toBase58(),
            rent: ProgramUtil.rentProgram.programId.toBase58(),
          })
          .transaction();

      makeInitVaultProtoConfigTx = async (
        adminPubkey: PublicKey
      ): Promise<Transaction> => {
        return await ProgramUtil.dripProgram.methods
          .initVaultProtoConfig({
            granularity: new BN(Granularity.DAILY),
            tokenADripTriggerSpread: 100,
            tokenBWithdrawalSpread: 100,
            tokenBReferralSpread: 25,
            admin: adminPubkey,
          })
          .accounts({
            vaultProtoConfig: vaultProtoConfigKeypair.publicKey,
            creator: TestUtil.provider.wallet.publicKey,
            systemProgram: ProgramUtil.systemProgram.programId,
          })
          .transaction();
      };

      const initVaultProtoConfigTx = await makeInitVaultProtoConfigTx(
        adminKeypair.publicKey
      );

      await TestUtil.provider.sendAndConfirm(initVaultProtoConfigTx, [
        vaultProtoConfigKeypair,
      ]);
    });

    it("vault_proto_config.admin can initialize a vault", async () => {
      const vaultProtoConfig = await AccountUtil.fetchVaultProtoConfigAccount(
        vaultProtoConfigKeypair.publicKey
      );

      vaultProtoConfig.admin
        .toBase58()
        .should.equal(adminKeypair.publicKey.toBase58());

      const blockhash = await TestUtil.provider.connection.getLatestBlockhash();
      (
        await TestUtil.provider.connection
          .sendTransaction(await makeInitVaultTx(adminKeypair.publicKey), [
            adminKeypair,
          ])
          .then((tx) =>
            TestUtil.provider.connection.confirmTransaction(
              {
                signature: tx,
                ...blockhash,
              },
              "finalized"
            )
          )
      ).should.not.throw();
    });

    it("non vault_proto_config.admin cannot initialize a vault", async () => {
      const vaultProtoConfig = await AccountUtil.fetchVaultProtoConfigAccount(
        vaultProtoConfigKeypair.publicKey
      );

      vaultProtoConfig.admin
        .toBase58()
        .should.equal(adminKeypair.publicKey.toBase58());

      const randoKeypair = generatePair();
      await SolUtil.fundAccount(
        randoKeypair.publicKey,
        SolUtil.solToLamports(1)
      );

      const initVaultTx = await makeInitVaultTx(randoKeypair.publicKey);

      await TestUtil.provider.connection
        .sendTransaction(initVaultTx, [randoKeypair])
        .should.be.rejectedWith(/0x177d/);
    });
  });

  describe("test invalid program id's", () => {
    let vaultPDA: PDA;
    let vaultTokenA_ATA, vaultTokenB_ATA: PublicKey;

    // Values the same for all tests, no need for a beforeEach
    before(async () => {
      vaultPDA = await getVaultPDA(
        tokenA.publicKey,
        tokenB.publicKey,
        vaultProtoConfigAccount
      );
      [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
        findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
        findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
      ]);
    });

    it("should fail to initialize when system program is passed in", async () => {
      await VaultUtil.initVault(
        vaultPDA.publicKey,
        vaultProtoConfigAccount,
        tokenA.publicKey,
        tokenB.publicKey,
        vaultTokenA_ATA,
        vaultTokenB_ATA,
        treasuryTokenBAccount,
        undefined,
        { systemProgram: generatePair().publicKey }
      ).should.be.rejectedWith(/0xbc0/);
    });

    it("should fail to initialize when invalid token program is passed in", async () => {
      await VaultUtil.initVault(
        vaultPDA.publicKey,
        vaultProtoConfigAccount,
        tokenA.publicKey,
        tokenB.publicKey,
        vaultTokenA_ATA,
        vaultTokenB_ATA,
        treasuryTokenBAccount,
        undefined,
        { tokenProgram: generatePair().publicKey }
      ).should.be.rejectedWith(/0xbc0/);
    });

    it("should fail to initialize when invalid associated token program is passed in", async () => {
      await VaultUtil.initVault(
        vaultPDA.publicKey,
        vaultProtoConfigAccount,
        tokenA.publicKey,
        tokenB.publicKey,
        vaultTokenA_ATA,
        vaultTokenB_ATA,
        treasuryTokenBAccount,
        undefined,
        { associatedTokenProgram: generatePair().publicKey }
      ).should.be.rejectedWith(/0xbc0/);
    });

    it("should fail to initialize when invalid rent program is passed in", async () => {
      await VaultUtil.initVault(
        vaultPDA.publicKey,
        vaultProtoConfigAccount,
        tokenA.publicKey,
        tokenB.publicKey,
        vaultTokenA_ATA,
        vaultTokenB_ATA,
        treasuryTokenBAccount,
        undefined,
        { rent: generatePair().publicKey }
      ).should.be.rejectedWith(/0xbc7/);
    });
  });
}
