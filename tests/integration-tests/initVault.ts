import { AccountUtil } from "../utils/Account.util";
import { TokenUtil } from "../utils/Token.util";
import { VaultUtil } from "../utils/Vault.util";
import { PublicKey, Keypair } from "@solana/web3.js";
import { Token } from "@solana/spl-token";
import {
  findAssociatedTokenAddress,
  generatePair,
  generatePairs,
  getVaultPDA,
  Granularity,
  PDA,
} from "../utils/common.util";
import { SolUtils } from "../utils/SolUtils";
import { AnchorError } from "@project-serum/anchor";
import { findError } from "../utils/error.util";

export function testInitVault() {
  let vaultProtoConfigAccount: PublicKey;
  let tokenA: Token;
  let tokenB: Token;
  let treasuryTokenBAccount: PublicKey;

  beforeEach(async () => {
    const vaultProtoConfigKeypair = generatePair();
    const treasuryOwner = generatePair();
    await Promise.all([
      SolUtils.fundAccount(
        treasuryOwner.publicKey,
        SolUtils.solToLamports(0.1)
      ),
      VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
        granularity: Granularity.DAILY,
        triggerDCASpread: 5,
        baseWithdrawalSpread: 5,
        admin: generatePair().publicKey,
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

    // TODO(matcha): Somehow test vaultAccount.dcaActivationTimestamp
    vaultAccount.lastDcaPeriod.toString().should.equal("0");
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
      whitelistedSwaps
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
      whitelistedSwaps
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

    try {
      await VaultUtil.initVault(
        vaultPDA.publicKey,
        vaultProtoConfigAccount,
        tokenA.publicKey,
        tokenB.publicKey,
        vaultTokenA_ATA,
        vaultTokenB_ATA,
        treasuryTokenBAccount,
        whitelistedSwaps
      );
    } catch (e) {
      findError(
        e,
        new RegExp(".*A Vault May Limit to a Maximum of 5 Token Swaps")
      ).should.not.be.undefined();
    }
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
      new RegExp(
        ".*Cross-program invocation with unauthorized signer or writable account"
      )
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
      new RegExp(
        ".*Cross-program invocation with unauthorized signer or writable account"
      )
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
    ).should.rejectedWith(
      new RegExp(".*An account required by the instruction is missing")
    );
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
      try {
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
        );
      } catch (e) {
        findError(
          e,
          new RegExp(".*Program ID was not as expected")
        ).should.not.be.undefined();
      }
    });

    it("should fail to initialize when invalid token program is passed in", async () => {
      try {
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
        );
      } catch (e) {
        findError(
          e,
          new RegExp(".*Program ID was not as expected")
        ).should.not.be.undefined();
      }
    });

    it("should fail to initialize when invalid associated token program is passed in", async () => {
      try {
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
        );
      } catch (e) {
        findError(
          e,
          new RegExp(".*Program ID was not as expected")
        ).should.not.be.undefined();
      }
    });

    it("should fail to initialize when invalid rent program is passed in", async () => {
      try {
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
        );
      } catch (e) {
        findError(
          e,
          new RegExp(
            ".*The given public key does not match the required sysvar"
          )
        ).should.not.be.undefined();
      }
    });
  });
}
