import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { token } from '@project-serum/anchor/dist/cjs/utils';
import { findProgramAddressSync } from '@project-serum/anchor/dist/cjs/utils/pubkey';
import { AccountLayout, Token, TOKEN_PROGRAM_ID, AccountInfo } from '@solana/spl-token';
import { expect } from 'chai';
import { DcaVault } from '../target/types/dca_vault';
import { createTokenMint, fetchTokenAccount, fundAccount, generateNewKeypair, makeNewTx } from './utils';

describe('dca-vault', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.local());
  const provider = anchor.getProvider();
  const program = anchor.workspace.DcaVault as Program<DcaVault>;
  const MILLISECONDS_IN_A_DAY = 24 * 60 * 60 * 1000;

  describe('#initVaultProtoConfig', () => {
    it('initializes the vault proto config account', async () => {
      const vaultProtoConfig = generateNewKeypair();
      const granularity = new anchor.BN(MILLISECONDS_IN_A_DAY);

      await program.rpc.initVaultProtoConfig(granularity, {
        accounts: {
          vaultProtoConfig: vaultProtoConfig.publicKey,
          creator: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [vaultProtoConfig]
      });

      const vaultProtoConfigAccount = await program.account.vaultProtoConfig.fetch(vaultProtoConfig.publicKey);

      expect(vaultProtoConfigAccount.granularity.toString()).to.be.equal(granularity.toString());
    });
  });

  describe('#initVault', () => {
    let vaultProtoConfigAccount: anchor.web3.PublicKey;

    beforeEach(async () => {
      const vaultProtoConfig = generateNewKeypair();
      const granularity = new anchor.BN(MILLISECONDS_IN_A_DAY);

      await program.rpc.initVaultProtoConfig(granularity, {
        accounts: {
          vaultProtoConfig: vaultProtoConfig.publicKey,
          creator: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [vaultProtoConfig]
      });

      vaultProtoConfigAccount = vaultProtoConfig.publicKey;
    });

    it('initializes the vault account', async () => {
      const tokenA = await createTokenMint(provider, 6);
      const tokenB = await createTokenMint(provider, 6);

      const [vaultAddress, vaultBump] = findProgramAddressSync(
        [
          Buffer.from("dca-vault-v1"),
          tokenA.publicKey.toBytes(),
          tokenB.publicKey.toBytes(),
          vaultProtoConfigAccount.toBytes(),
        ],
        program.programId
      );

      const [tokenAAccountAddr, tokenAAccountBump] = findProgramAddressSync(
        [
          Buffer.from("token_a_account"),
          vaultAddress.toBytes(),
          tokenA.publicKey.toBytes(),
        ],
        program.programId
      );

      const [tokenBAccountAddr, tokenBAccountBump] = findProgramAddressSync(
        [
          Buffer.from("token_b_account"),
          vaultAddress.toBytes(),
          tokenB.publicKey.toBytes(),
        ],
        program.programId
      );

      await program.rpc.initVault({
        vault: vaultBump,
        tokenAAccount: tokenAAccountBump,
        tokenBAccount: tokenBAccountBump
      }, {
        accounts: {
          vault: vaultAddress,
          vaultProtoConfig: vaultProtoConfigAccount,
          tokenAMint: tokenA.publicKey,
          tokenBMint: tokenB.publicKey,
          tokenAAccount: tokenAAccountAddr,
          tokenBAccount: tokenBAccountAddr,
          creator: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
      });

      const vaultAccount = await program.account.vault.fetch(vaultAddress);

      expect(vaultAccount.protoConfig.toBase58()).to.be.equal(vaultProtoConfigAccount.toBase58());
      expect(vaultAccount.tokenAMint.toBase58()).to.be.equal(tokenA.publicKey.toBase58());
      expect(vaultAccount.tokenBMint.toBase58()).to.be.equal(tokenB.publicKey.toBase58());
      expect(vaultAccount.tokenAAccount.toBase58()).to.be.equal(tokenAAccountAddr.toBase58());
      expect(vaultAccount.tokenBAccount.toBase58()).to.be.equal(tokenBAccountAddr.toBase58());

      const tokenAAccount = await fetchTokenAccount(provider, vaultAccount.tokenAAccount);
      const tokenBAccount = await fetchTokenAccount(provider, vaultAccount.tokenBAccount);

      expect(tokenAAccount.mint.toBase58()).to.be.equal(tokenA.publicKey.toBase58());
      expect(tokenBAccount.mint.toBase58()).to.be.equal(tokenB.publicKey.toBase58());
      expect(tokenAAccount.owner.toBase58()).to.be.equal(vaultAddress.toBase58());
      expect(tokenBAccount.owner.toBase58()).to.be.equal(vaultAddress.toBase58());
    });
  });
});
