import { PublicKey } from "@solana/web3.js";
import { KeypairUtils } from "../utils/KeypairUtils";
import { VaultUtils } from "../utils/VaultUtils";
import { TokenUtils } from "../utils/TokenUtils";
import { PDAUtils } from "../utils/PDAUtils";
import { AccountUtils } from "../utils/AccountUtils";
import { Granularity } from "../utils/Granularity";
import "should";

// TODO(matcha): More exhaustive tests

export function testInitVaultPeriod() {
  let vaultProtoConfigPubkey: PublicKey;
  let vaultPubkey: PublicKey;
  let tokenAMint: PublicKey;
  let tokenBMint: PublicKey;

  beforeEach(async () => {
    const vaultProtoConfigKeypair = KeypairUtils.generatePair();
    await VaultUtils.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.DAILY,
    });
    vaultProtoConfigPubkey = vaultProtoConfigKeypair.publicKey;

    const [tokenA, tokenB] = await Promise.all([
      TokenUtils.createMockUSDCMint(),
      TokenUtils.createMockBTCMint(),
    ]);

    [tokenAMint, tokenBMint] = [tokenA.publicKey, tokenB.publicKey];

    const vaultPDA = await PDAUtils.getVaultPDA(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultProtoConfigPubkey
    );

    const [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      PDAUtils.findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
      PDAUtils.findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
    ]);

    await VaultUtils.initVault(
      vaultPDA.publicKey,
      vaultProtoConfigPubkey,
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTokenA_ATA,
      vaultTokenB_ATA
    );

    vaultPubkey = vaultPDA.publicKey;
  });

  it("initializes the vault period account correctly", async () => {
    const { publicKey: vaultPeriodPubkey } = await PDAUtils.getVaultPeriodPDA(
      vaultPubkey,
      69
    );

    await VaultUtils.initVaultPeriod(
      vaultPubkey,
      vaultPeriodPubkey,
      vaultProtoConfigPubkey,
      tokenAMint,
      tokenBMint,
      69
    );

    const vaultPeriodAccount = await AccountUtils.fetchVaultPeriodAccount(
      vaultPeriodPubkey
    );

    vaultPeriodAccount.vault.toBase58().should.equal(vaultPubkey.toBase58());
    vaultPeriodAccount.periodId.toString().should.equal("69");
    vaultPeriodAccount.twap.toString().should.equal("0");
    vaultPeriodAccount.dar.toString().should.equal("0");
  });
}
