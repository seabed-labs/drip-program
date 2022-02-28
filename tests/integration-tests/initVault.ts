import { web3 } from "@project-serum/anchor";
import { AccountUtils } from "../utils/AccountUtils";
import { Granularity } from "../utils/Granularity";
import { KeypairUtils } from "../utils/KeypairUtils";
import { PDA, PDAUtils } from "../utils/PDAUtils";
import { TokenUtils } from "../utils/TokenUtils";
import { VaultUtils } from "../utils/VaultUtils";
import { PublicKey } from "@solana/web3.js";
import "should";
import { Token } from "@solana/spl-token";

export function testInitVault() {
  let vaultProtoConfigAccount: web3.PublicKey;
  let tokenA: Token;
  let tokenB: Token;

  beforeEach(async () => {
    const vaultProtoConfigKeypair = KeypairUtils.generatePair();
    await VaultUtils.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.DAILY,
    });
    vaultProtoConfigAccount = vaultProtoConfigKeypair.publicKey;

    [tokenA, tokenB] = await Promise.all([
      TokenUtils.createMockUSDCMint(),
      TokenUtils.createMockBTCMint(),
    ]);
  });

  it("initializes the vault account correctly", async () => {
    const vaultPDA = await PDAUtils.getVaultPDA(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultProtoConfigAccount
    );

    const [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      PDAUtils.findAssociatedTokenAddress(
        vaultPDA.pubkey as PublicKey,
        tokenA.publicKey
      ),
      PDAUtils.findAssociatedTokenAddress(
        vaultPDA.pubkey as PublicKey,
        tokenB.publicKey
      ),
    ]);

    await VaultUtils.initVault(
      vaultPDA.pubkey,
      vaultProtoConfigAccount,
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTokenA_ATA,
      vaultTokenB_ATA
    );

    const vaultAccount = await AccountUtils.fetchVaultAccount(vaultPDA.pubkey);
    const [vaultTokenAAccount, vaultTokenBAccount] = await Promise.all([
      TokenUtils.fetchTokenAccountInfo(vaultTokenA_ATA),
      TokenUtils.fetchTokenAccountInfo(vaultTokenB_ATA),
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
      .should.equal(vaultPDA.pubkey.toString());
    vaultTokenBAccount.owner
      .toString()
      .should.equal(vaultPDA.pubkey.toString());

    vaultAccount.bump.toString().should.equal(vaultPDA.bump.toString());
  });

  it("should fail to initialize when vault PDA is generated with invalid seeds", async () => {
    // NOTE: swapped tokenA and tokenB
    const vaultPDA = await PDAUtils.getVaultPDA(
      tokenB.publicKey,
      tokenA.publicKey,
      vaultProtoConfigAccount
    );

    const [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      PDAUtils.findAssociatedTokenAddress(
        vaultPDA.pubkey as PublicKey,
        tokenA.publicKey
      ),
      PDAUtils.findAssociatedTokenAddress(
        vaultPDA.pubkey as PublicKey,
        tokenB.publicKey
      ),
    ]);

    await VaultUtils.initVault(
      vaultPDA.pubkey,
      vaultProtoConfigAccount,
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTokenA_ATA,
      vaultTokenB_ATA
    ).should.rejectedWith(
      new RegExp(
        ".*Cross-program invocation with unauthorized signer or writable account"
      )
    );
  });

  it("should fail to initialize when vault PDA is on ed25519 curve", async () => {
    const vaultPDAPublicKey = KeypairUtils.generatePair().publicKey;

    const [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      PDAUtils.findAssociatedTokenAddress(vaultPDAPublicKey, tokenA.publicKey),
      PDAUtils.findAssociatedTokenAddress(vaultPDAPublicKey, tokenB.publicKey),
    ]);

    await VaultUtils.initVault(
      vaultPDAPublicKey,
      vaultProtoConfigAccount,
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTokenA_ATA,
      vaultTokenB_ATA
    ).should.rejectedWith(
      new RegExp(
        ".*Cross-program invocation with unauthorized signer or writable account"
      )
    );
  });

  it("should fail to initialize when token accounts are not ATA's", async () => {
    const vaultPDA = await PDAUtils.getVaultPDA(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultProtoConfigAccount
    );

    const [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      KeypairUtils.generatePair().publicKey,
      KeypairUtils.generatePair().publicKey,
    ]);

    await VaultUtils.initVault(
      vaultPDA.pubkey,
      vaultProtoConfigAccount,
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTokenA_ATA,
      vaultTokenB_ATA
    ).should.rejectedWith(
      new RegExp(".*An account required by the instruction is missing")
    );
  });

  describe("test invalid program id's", () => {
    let vaultPDA: PDA;
    let vaultTokenA_ATA, vaultTokenB_ATA: web3.PublicKey;

    // Values the same for all tests, no need for a beforeEach
    before(async () => {
      vaultPDA = await PDAUtils.getVaultPDA(
        tokenA.publicKey,
        tokenB.publicKey,
        vaultProtoConfigAccount
      );
      [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
        PDAUtils.findAssociatedTokenAddress(
          vaultPDA.pubkey as PublicKey,
          tokenA.publicKey
        ),
        PDAUtils.findAssociatedTokenAddress(
          vaultPDA.pubkey as PublicKey,
          tokenB.publicKey
        ),
      ]);
    });

    it("should fail to initialize when system program is passed in", async () => {
      await VaultUtils.initVault(
        vaultPDA.pubkey,
        vaultProtoConfigAccount,
        tokenA.publicKey,
        tokenB.publicKey,
        vaultTokenA_ATA,
        vaultTokenB_ATA,
        { systemProgram: KeypairUtils.generatePair().publicKey }
      ).should.rejectedWith(new RegExp(".*Program ID was not as expected"));
    });

    it("should fail to initialize when invalid token program is passed in", async () => {
      await VaultUtils.initVault(
        vaultPDA.pubkey,
        vaultProtoConfigAccount,
        tokenA.publicKey,
        tokenB.publicKey,
        vaultTokenA_ATA,
        vaultTokenB_ATA,
        { tokenProgram: KeypairUtils.generatePair().publicKey }
      ).should.rejectedWith(new RegExp(".*Program ID was not as expected"));
    });

    it("should fail to initialize when invalid associated token program is passed in", async () => {
      await VaultUtils.initVault(
        vaultPDA.pubkey,
        vaultProtoConfigAccount,
        tokenA.publicKey,
        tokenB.publicKey,
        vaultTokenA_ATA,
        vaultTokenB_ATA,
        { associatedTokenProgram: KeypairUtils.generatePair().publicKey }
      ).should.rejectedWith(new RegExp(".*Program ID was not as expected"));
    });

    it("should fail to initialize when invalid rent program is passed in", async () => {
      await VaultUtils.initVault(
        vaultPDA.pubkey,
        vaultProtoConfigAccount,
        tokenA.publicKey,
        tokenB.publicKey,
        vaultTokenA_ATA,
        vaultTokenB_ATA,
        { rent: KeypairUtils.generatePair().publicKey }
      ).should.rejectedWith(new RegExp(".*invalid program argument"));
    });
  });
}
