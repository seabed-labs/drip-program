import { BN, web3 } from "@project-serum/anchor";
import { AccountUtils } from "../utils/AccountUtils";
import { ExpectUtils } from "../utils/ExpectUtils";
import { Granularity } from "../utils/Granularity";
import { KeypairUtils } from "../utils/KeypairUtils";
import { CONSTANT_SEEDS, PDAUtils } from "../utils/PDAUtils";
import { ProgramUtils } from "../utils/ProgramUtils";
import { TokenUtils } from "../utils/TokenUtils";
import { VaultUtils } from "../utils/VaultUtils";

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

    const [vaultTokenAAccountPDA, vaultTokenBAccountPDA] = await Promise.all([
      PDAUtils.getTokenAccountPDA(
        ProgramUtils.vaultProgram.programId,
        CONSTANT_SEEDS.tokenAAccount,
        vaultPDA.pubkey,
        tokenA.publicKey,
      ),
      PDAUtils.getTokenAccountPDA(
        ProgramUtils.vaultProgram.programId,
        CONSTANT_SEEDS.tokenBAccount,
        vaultPDA.pubkey,
        tokenB.publicKey,
      )
    ]); 

    await VaultUtils.initVault(
      vaultPDA,
      vaultProtoConfigAccount,
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTokenAAccountPDA,
      vaultTokenBAccountPDA,
    );

    const vaultAccount = await AccountUtils.fetchVaultAccount(vaultPDA.pubkey);

    const [vaultTokenAAccount, vaultTokenBAccount] = await Promise.all([
      TokenUtils.fetchTokenAccountInfo(vaultAccount.tokenAAccount),
      TokenUtils.fetchTokenAccountInfo(vaultAccount.tokenBAccount),
    ]);

    // TODO(matcha): Somehow test vaultAccount.dcaActivationTimestamp
    ExpectUtils.expectBNToEqual(vaultAccount.lastDcaPeriod, "0");
    ExpectUtils.expectBNToEqual(vaultAccount.dripAmount, "0");

    web3.SYSVAR_CLOCK_PUBKEY

    ExpectUtils.batchExpectPubkeysToBeEqual(
      [vaultAccount.protoConfig, vaultProtoConfigAccount],
      [vaultAccount.tokenAMint, tokenA.publicKey],
      [vaultAccount.tokenBMint, tokenB.publicKey],
      [vaultAccount.tokenAAccount, vaultTokenAAccountPDA.pubkey],
      [vaultAccount.tokenBAccount, vaultTokenBAccountPDA.pubkey],
      [vaultTokenAAccount.mint, tokenA.publicKey],
      [vaultTokenBAccount.mint, tokenB.publicKey],
      [vaultTokenAAccount.owner, vaultPDA.pubkey],
      [vaultTokenBAccount.owner, vaultPDA.pubkey],
    );
  });
}