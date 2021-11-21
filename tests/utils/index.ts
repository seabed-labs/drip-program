import { web3, Provider } from '@project-serum/anchor';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';

export function generateNewKeypair(): web3.Keypair {
  return web3.Keypair.generate();
}

export async function makeNewTx(provider: Provider): Promise<web3.Transaction> {
  return new web3.Transaction({
    feePayer: provider.wallet.publicKey,
    recentBlockhash: (await provider.connection.getRecentBlockhash()).blockhash,
  });
}

export async function fundAccount(provider: Provider, to: web3.PublicKey, lamports: number): Promise<void> {
  const tx = await makeNewTx(provider);

  tx.add(web3.SystemProgram.transfer({
    fromPubkey: provider.wallet.publicKey,
    toPubkey: to,
    lamports,
  }))

  await provider.wallet.signTransaction(tx);
  await web3.sendAndConfirmRawTransaction(provider.connection, tx.serialize());
}

export async function createTokenMint(
  provider: Provider,
  decimals: number,
): Promise<Token> {
  const tokenAccountsFunder = generateNewKeypair();
  await fundAccount(provider, tokenAccountsFunder.publicKey, 10 * web3.LAMPORTS_PER_SOL);

  return await Token.createMint(
    provider.connection,
    tokenAccountsFunder,
    provider.wallet.publicKey,
    provider.wallet.publicKey,
    decimals,
    TOKEN_PROGRAM_ID
  );
}