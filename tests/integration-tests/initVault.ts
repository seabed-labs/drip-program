import { AccountUtil } from "../utils/Account.util";
import { TokenUtil } from "../utils/Token.util";
import { VaultUtil } from "../utils/Vault.util";
import { PublicKey } from "@solana/web3.js";
import { Token } from "@solana/spl-token";
import {
  findAssociatedTokenAddress,
  generatePair,
  getVaultPDA,
  Granularity,
  PDA,
} from "../utils/common.util";

export function testInitVault() {
  let vaultProtoConfigAccount: PublicKey;
  let tokenA: Token;
  let tokenB: Token;

  beforeEach(async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.DAILY,
    });
    vaultProtoConfigAccount = vaultProtoConfigKeypair.publicKey;

    [tokenA, tokenB] = await Promise.all([
      TokenUtil.createMockUSDCMint(),
      TokenUtil.createMockBTCMint(),
    ]);
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
      vaultTokenB_ATA
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
      vaultTokenB_ATA
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
      vaultTokenB_ATA
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
      vaultTokenB_ATA
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
      await VaultUtil.initVault(
        vaultPDA.publicKey,
        vaultProtoConfigAccount,
        tokenA.publicKey,
        tokenB.publicKey,
        vaultTokenA_ATA,
        vaultTokenB_ATA,
        { systemProgram: generatePair().publicKey }
      ).should.rejectedWith(new RegExp(".*Program ID was not as expected"));
    });

    it("should fail to initialize when invalid token program is passed in", async () => {
      await VaultUtil.initVault(
        vaultPDA.publicKey,
        vaultProtoConfigAccount,
        tokenA.publicKey,
        tokenB.publicKey,
        vaultTokenA_ATA,
        vaultTokenB_ATA,
        { tokenProgram: generatePair().publicKey }
      ).should.rejectedWith(new RegExp(".*Program ID was not as expected"));
    });

    it("should fail to initialize when invalid associated token program is passed in", async () => {
      await VaultUtil.initVault(
        vaultPDA.publicKey,
        vaultProtoConfigAccount,
        tokenA.publicKey,
        tokenB.publicKey,
        vaultTokenA_ATA,
        vaultTokenB_ATA,
        { associatedTokenProgram: generatePair().publicKey }
      ).should.rejectedWith(new RegExp(".*Program ID was not as expected"));
    });

    it("should fail to initialize when invalid rent program is passed in", async () => {
      await VaultUtil.initVault(
        vaultPDA.publicKey,
        vaultProtoConfigAccount,
        tokenA.publicKey,
        tokenB.publicKey,
        vaultTokenA_ATA,
        vaultTokenB_ATA,
        { rent: generatePair().publicKey }
      ).should.rejectedWith(new RegExp(".*invalid program argument"));
    });
  });
}
