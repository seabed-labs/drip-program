import { BN, web3 } from "@project-serum/anchor";
import { AccountUtils } from "../utils/AccountUtils";
import { ExpectUtils } from "../utils/ExpectUtils";
import { Granularity } from "../utils/Granularity";
import { KeypairUtils } from "../utils/KeypairUtils";
import { CONSTANT_SEEDS, PDAUtils } from "../utils/PDAUtils";
import { ProgramUtils } from "../utils/ProgramUtils";
import { TokenUtils } from "../utils/TokenUtils";
import { VaultUtils } from "../utils/VaultUtils";
import { expect } from "chai";
import {PublicKey} from "@solana/web3.js";

export function testInitVault() {
  let vaultProtoConfigAccount: web3.PublicKey;

  beforeEach(async () => {
    const vaultProtoConfigKeypair = KeypairUtils.generatePair();
    await VaultUtils.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.DAILY,
    });
    vaultProtoConfigAccount = vaultProtoConfigKeypair.publicKey;
  });

  it('initializes the vault account correctly', async () => {
    const [tokenA, tokenB] = await Promise.all([
      TokenUtils.createMockUSDCMint(),
      TokenUtils.createMockBTCMint(),
    ]);

    const vaultPDA = await PDAUtils.getVaultPDA(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultProtoConfigAccount,
    );

    const [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      PDAUtils.findAssociatedTokenAddress(vaultPDA.pubkey as PublicKey, tokenA.publicKey),
      PDAUtils.findAssociatedTokenAddress(vaultPDA.pubkey as PublicKey, tokenB.publicKey),
    ]);

    await VaultUtils.initVault(
      vaultPDA,
      vaultProtoConfigAccount,
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTokenA_ATA,
      vaultTokenB_ATA,
    );

    const vaultAccount = await AccountUtils.fetchVaultAccount(vaultPDA.pubkey);
    const [vaultTokenAAccount, vaultTokenBAccount] = await Promise.all([
      TokenUtils.fetchTokenAccountInfo(vaultTokenA_ATA),
      TokenUtils.fetchTokenAccountInfo(vaultTokenB_ATA),
    ]);

    // TODO(matcha): Somehow test vaultAccount.dcaActivationTimestamp
    ExpectUtils.expectBNToEqual(vaultAccount.lastDcaPeriod, "0");
    ExpectUtils.expectBNToEqual(vaultAccount.dripAmount, "0");

    ExpectUtils.batchExpectPubkeysToBeEqual(
      [vaultAccount.protoConfig, vaultProtoConfigAccount],
      [vaultAccount.tokenAMint, tokenA.publicKey],
      [vaultAccount.tokenBMint, tokenB.publicKey],
      [vaultAccount.tokenAAccount, vaultTokenA_ATA],
      [vaultAccount.tokenBAccount, vaultTokenB_ATA],
      [vaultTokenAAccount.mint, tokenA.publicKey],
      [vaultTokenBAccount.mint, tokenB.publicKey],
      [vaultTokenAAccount.owner, vaultPDA.pubkey],
      [vaultTokenBAccount.owner, vaultPDA.pubkey],
    );

    expect(vaultAccount.bump.toString()).to.equal(vaultPDA.bump.toString());
  });
}