import * as anchor from '@project-serum/anchor';
import { expect } from 'chai';
import { ExpectUtils } from './utils/ExpectUtils';
import { PDAUtils } from './utils/PDAUtils';
import { SetupUtils } from './utils/SetupUtils';
import { TokenUtils } from './utils/TokenUtils';

describe('dca-vault', () => {
  describe('#initVaultProtoConfig', () => {
    it('initializes the vault proto config account', async () => {
      const { vaultProtoConfigAccount } = await SetupUtils.setupVaultProtoConfig(100);

      ExpectUtils.expectBNToEqual(vaultProtoConfigAccount.granularity, 100);
    });
  });

  describe('#initVault', () => {
    let protoConfigPubkey: anchor.web3.PublicKey;

    beforeEach(async () => {
      const { vaultProtoConfigAccountPubkey } = await SetupUtils.setupVaultProtoConfig();
      protoConfigPubkey = vaultProtoConfigAccountPubkey;
    });

    it('initializes the vault account', async () => {
      const tokenA = await TokenUtils.createMockUSDCMint();
      const tokenB = await TokenUtils.createMockBTCMint();

      const vaultPDA = await PDAUtils.getVaultPDA(
        tokenA.publicKey,
        tokenB.publicKey,
        protoConfigPubkey,
      )

      const tokenAAccountPDA = await PDAUtils.getTokenAPDA(
        vaultPDA.pubkey,
        tokenA.publicKey,
      )

      const tokenBAccountPDA = await PDAUtils.getTokenBPDA(
        vaultPDA.pubkey,
        tokenB.publicKey,
      )

      const { vaultAccount } = await SetupUtils.setupVault(
        protoConfigPubkey,
        vaultPDA,
        tokenA.publicKey,
        tokenB.publicKey,
        tokenAAccountPDA,
        tokenBAccountPDA,
      );

      ExpectUtils.batchExpectPubkeysToBeEqual(
        [vaultAccount.protoConfig, protoConfigPubkey],
        [vaultAccount.tokenAMint, tokenA.publicKey],
        [vaultAccount.tokenBMint, tokenB.publicKey],
        [vaultAccount.tokenAAccount, tokenAAccountPDA.pubkey],
        [vaultAccount.tokenBAccount, tokenBAccountPDA.pubkey],
      );

      const tokenAAccount = await TokenUtils.fetchTokenAccountInfo(vaultAccount.tokenAAccount);
      const tokenBAccount = await TokenUtils.fetchTokenAccountInfo(vaultAccount.tokenBAccount);

      ExpectUtils.batchExpectPubkeysToBeEqual(
        [tokenAAccount.mint, tokenA.publicKey],
        [tokenBAccount.mint, tokenB.publicKey],
        [tokenAAccount.owner, vaultPDA.pubkey],
        [tokenBAccount.owner, vaultPDA.pubkey],
      );
    });
  });
});
