import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { findProgramAddressSync } from '@project-serum/anchor/dist/cjs/utils/pubkey';
import { DcaVault } from '../target/types/dca_vault';

describe('dca-vault', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.DcaVault as Program<DcaVault>;

  const usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const ethMint = "2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk";

  it('Is initialized!', async () => {
    // Add your test
    const usdcMintKey = new anchor.web3.PublicKey(usdcMint);
    const ethMintKey = new anchor.web3.PublicKey(ethMint);
    const [vaultAddress, bump] = findProgramAddressSync([new Buffer("dca-vault-v1", "utf-8"), usdcMintKey.toBuffer(), ethMintKey.toBuffer(), new Buffer("00 5C 26 05", "utf-8")], program.programId);

    const tx = await program.rpc.initVault(new anchor.BN(86400000), new anchor.BN(bump), {
        accounts: {
            vault: vaultAddress,
            tokenAMint: usdcMintKey,
            tokenBMint: ethMintKey,
            creator: anchor.getProvider().wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
        },
    });
    console.log("Your transaction signature", tx);
  });
});
