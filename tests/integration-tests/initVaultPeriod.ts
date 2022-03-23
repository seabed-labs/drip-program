import { PublicKey } from "@solana/web3.js";
import { VaultUtil } from "../utils/Vault.util";
import { TokenUtil } from "../utils/Token.util";
import { AccountUtil } from "../utils/Account.util";
import "should";
import {
  findAssociatedTokenAddress,
  generatePair,
  getVaultPDA,
  getVaultPeriodPDA,
  Granularity,
} from "../utils/common.util";

// TODO(matcha): More exhaustive tests

export function testInitVaultPeriod() {
  let vaultProtoConfigPubkey: PublicKey;
  let vaultPubkey: PublicKey;
  let tokenAMint: PublicKey;
  let tokenBMint: PublicKey;

  beforeEach(async () => {
    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.DAILY,
      triggerDCASpread: 5,
      baseWithdrawalDCASpread: 5,
    });
    vaultProtoConfigPubkey = vaultProtoConfigKeypair.publicKey;

    const [tokenA, tokenB] = await Promise.all([
      TokenUtil.createMockUSDCMint(),
      TokenUtil.createMockBTCMint(),
    ]);

    [tokenAMint, tokenBMint] = [tokenA.publicKey, tokenB.publicKey];

    const vaultPDA = await getVaultPDA(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultProtoConfigPubkey
    );

    const [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
    ]);

    await VaultUtil.initVault(
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
    const { publicKey: vaultPeriodPubkey } = await getVaultPeriodPDA(
      vaultPubkey,
      69
    );

    await VaultUtil.initVaultPeriod(
      vaultPubkey,
      vaultPeriodPubkey,
      vaultProtoConfigPubkey,
      tokenAMint,
      tokenBMint,
      69
    );

    const vaultPeriodAccount = await AccountUtil.fetchVaultPeriodAccount(
      vaultPeriodPubkey
    );

    vaultPeriodAccount.vault.toBase58().should.equal(vaultPubkey.toBase58());
    vaultPeriodAccount.periodId.toString().should.equal("69");
    vaultPeriodAccount.twap.toString().should.equal("0");
    vaultPeriodAccount.dar.toString().should.equal("0");
  });
}
