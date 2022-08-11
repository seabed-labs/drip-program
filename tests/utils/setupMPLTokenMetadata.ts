import "should";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { PDAUtil } from "@orca-so/whirlpools-sdk";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
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
      "8ULDKGmKJJaZa32eiL36ARr6cFaZaoAXAosWeg5r17ra"
    );
    const btcPubkey = new PublicKey(
      "5nY3xT4PJe7NU41zqBx5UACHDckrimmfwznv4uLenrQg"
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
            uri: "https://devnet.api.drip.dcaf.so/v1/drip/8ULDKGmKJJaZa32eiL36ARr6cFaZaoAXAosWeg5r17ra/tokenmetadata",
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
            uri: "https://devnet.api.drip.dcaf.so/v1/drip/5nY3xT4PJe7NU41zqBx5UACHDckrimmfwznv4uLenrQg/tokenmetadata",
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
    const tx = new Transaction().add(usdtIx).add(btcIx);
    const txId = await TestUtil.provider.sendAndConfirm(tx, [
      tokenOwnerKeypair,
    ]);
    console.log(txId);
  });

  it("setup token metadata", async () => {
    true.should.be.true();
  });
}