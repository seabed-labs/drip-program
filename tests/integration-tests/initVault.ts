import { web3 } from "@project-serum/anchor";
import { AccountUtils } from "../utils/AccountUtils";
import { Granularity } from "../utils/Granularity";
import { KeypairUtils } from "../utils/KeypairUtils";
import { PDAUtils } from "../utils/PDAUtils";
import { TokenUtils } from "../utils/TokenUtils";
import { VaultUtils } from "../utils/VaultUtils";
import { PublicKey } from "@solana/web3.js";
import "should";

export function testInitVault() {
  let vaultProtoConfigAccount: web3.PublicKey;

  beforeEach(async () => {
    const vaultProtoConfigKeypair = KeypairUtils.generatePair();
    await VaultUtils.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.DAILY,
    });
    vaultProtoConfigAccount = vaultProtoConfigKeypair.publicKey;
  });

  it("initializes the vault account correctly", async () => {
    const [tokenA, tokenB] = await Promise.all([
      TokenUtils.createMockUSDCMint(),
      TokenUtils.createMockBTCMint(),
    ]);

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
      vaultPDA,
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
}
