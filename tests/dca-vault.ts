import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { findProgramAddressSync } from '@project-serum/anchor/dist/cjs/utils/pubkey';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { expect } from 'chai';
import { DcaVault } from '../target/types/dca_vault';
import { createTokenMint, fundAccount, generateNewKeypair, makeNewTx } from './utils';

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

      const [vaultAddress, bump] = findProgramAddressSync(
        [
          Buffer.from("dca-vault-v1"),
          tokenA.publicKey.toBytes(),
          tokenB.publicKey.toBytes(),
          vaultProtoConfigAccount.toBytes(),
        ],
        program.programId
      );

      await program.rpc.initVault(bump, {
        accounts: {
          vault: vaultAddress,
          vaultProtoConfig: vaultProtoConfigAccount,
          tokenAMint: tokenA.publicKey,
          tokenBMint: tokenB.publicKey,
          creator: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      });

      const vaultAccount = await program.account.vault.fetch(vaultAddress);

      expect(vaultAccount.protoConfig.toBase58()).to.be.equal(vaultProtoConfigAccount.toBase58());
      expect(vaultAccount.tokenAMint.toBase58()).to.be.equal(tokenA.publicKey.toBase58());
      expect(vaultAccount.tokenBMint.toBase58()).to.be.equal(tokenB.publicKey.toBase58());
    });
  });
});
