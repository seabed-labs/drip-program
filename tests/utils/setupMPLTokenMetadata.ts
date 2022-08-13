import "should";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { PDAUtil } from "@orca-so/whirlpools-sdk";
import {
  createCreateMetadataAccountV3Instruction,
  createSetTokenStandardInstruction,
} from "@metaplex-foundation/mpl-token-metadata";
import { TestUtil } from "./config.util";

describe("#setupTokenMetadata", setupTokenMetadata);

export function setupTokenMetadata() {
  before(async () => {
    console.log("hello");
    const keypairData = process.env.TOKEN_OWNER_KEYPAIR;
    const tokenOwnerKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(keypairData))
    );

    const usdtPubkey = new PublicKey(
      "H9gBUJs5Kc5zyiKRTzZcYom4Hpj9VPHLy4VzExTVPgxa"
    );
    const btcPubkey = new PublicKey(
      "7ihthG4cFydyDnuA3zmJrX13ePGpLcANf3tHLmKLPN7M"
    );

    const usdtPositionMetadataAccount =
      PDAUtil.getPositionMetadata(usdtPubkey).publicKey;
    console.log(
      "usdtPositionMetadataAccount",
      usdtPositionMetadataAccount.toBase58()
    );
    const btcPositionMetadataAccount =
      PDAUtil.getPositionMetadata(btcPubkey).publicKey;
    console.log(
      "btcPositionMetadataAccount",
      btcPositionMetadataAccount.toBase58()
    );

    const usdtIx = await createCreateMetadataAccountV3Instruction(
      {
        metadata: usdtPositionMetadataAccount,
        mint: usdtPubkey,
        mintAuthority: tokenOwnerKeypair.publicKey,
        payer: TestUtil.provider.wallet.publicKey,
        updateAuthority: tokenOwnerKeypair.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: {
            name: "USDT (Drip)",
            symbol: "USDT",
            uri: `https://devnet.api.drip.dcaf.so/v1/drip/${usdtPubkey.toBase58()}/tokenmetadata`,
            sellerFeeBasisPoints: 0,
            creators: undefined,
            collection: undefined,
            uses: undefined,
          },
          isMutable: true,
          collectionDetails: undefined,
        },
      }
    );
    const usdtTokenStandardIx = createSetTokenStandardInstruction({
      metadata: usdtPositionMetadataAccount,
      updateAuthority: tokenOwnerKeypair.publicKey,
      mint: usdtPubkey,
    });
    // createMetadataAccountV2

    const btcIx = await createCreateMetadataAccountV3Instruction(
      {
        metadata: btcPositionMetadataAccount,
        mint: btcPubkey,
        mintAuthority: tokenOwnerKeypair.publicKey,
        payer: TestUtil.provider.wallet.publicKey,
        updateAuthority: tokenOwnerKeypair.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: {
            name: "BTC (Drip)",
            symbol: "BTC",
            uri: `https://devnet.api.drip.dcaf.so/v1/drip/${btcPubkey.toBase58()}/tokenmetadata`,
            sellerFeeBasisPoints: 0,
            creators: undefined,
            collection: undefined,
            uses: undefined,
          },
          isMutable: true,
          collectionDetails: undefined,
        },
      }
    );
    const btcTokenStandardIx = createSetTokenStandardInstruction({
      metadata: btcPositionMetadataAccount,
      updateAuthority: tokenOwnerKeypair.publicKey,
      mint: btcPubkey,
    });

    const tx = new Transaction()
      .add(usdtIx)
      .add(btcIx)
      .add(usdtTokenStandardIx)
      .add(btcTokenStandardIx);
    const txId = await TestUtil.provider.sendAndConfirm(tx, [
      tokenOwnerKeypair,
    ]);
    console.log(txId);
  });

  it("setup token metadata", async () => {
    true.should.be.true();
  });
}
