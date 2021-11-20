import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { findProgramAddressSync } from '@project-serum/anchor/dist/cjs/utils/pubkey';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { DcaVault } from '../target/types/dca_vault';

describe('dca-vault', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.local());

  const program = anchor.workspace.DcaVault as Program<DcaVault>;

  it('Is initialized!', async () => {

    const provider = anchor.Provider.local();
    const keypair = anchor.web3.Keypair.generate();

    const fundTx = new anchor.web3.Transaction({
      feePayer: provider.wallet.publicKey,
      recentBlockhash: (await provider.connection.getRecentBlockhash()).blockhash,
    }).add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: keypair.publicKey,
        lamports: 1e10,
      })
    ); 

    const signedTx = await provider.wallet.signTransaction(fundTx);

    await anchor.web3.sendAndConfirmRawTransaction(provider.connection, signedTx.serialize());

    const tokenA = await Token.createMint(provider.connection, keypair, provider.wallet.publicKey, provider.wallet.publicKey, 6, TOKEN_PROGRAM_ID);
    const tokenB = await Token.createMint(provider.connection, keypair, provider.wallet.publicKey, provider.wallet.publicKey, 6, TOKEN_PROGRAM_ID);

    const [vaultAddress, bump] = findProgramAddressSync([Buffer.from("dca-vault-v1"), tokenA.publicKey.toBuffer(), tokenB.publicKey.toBuffer(), new Buffer("00 5C 26 05", "utf-8")], program.programId);

    const tx = await program.rpc.initVault(new anchor.BN(86400000), new anchor.BN(bump), {
        accounts: {
            // vault: vaultAddress,
            tokenAMint: tokenA.publicKey,
            tokenBMint: tokenB.publicKey,
            creator: anchor.getProvider().wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
        },
    });
    console.log("Your transaction signature", tx);
  });
});
