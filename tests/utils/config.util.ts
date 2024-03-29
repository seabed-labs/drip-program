import { AnchorProvider, Provider, setProvider } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

export class TestConfig {
  public readonly provider: AnchorProvider;
  private static _default = new TestConfig(
    process.env.ENV === "DEVNET"
      ? new AnchorProvider(
          new Connection("https://devnet.genesysgo.net", "confirmed"),
          NodeWallet.local(),
          AnchorProvider.defaultOptions(),
        )
      : AnchorProvider.local(),
  );

  constructor(provider: AnchorProvider) {
    if (process.env.ENV) {
      console.log(process.env.ENV);
    }
    setProvider(provider);
    this.provider = provider;
  }

  static get default(): TestConfig {
    return TestConfig._default;
  }
}

export class BackwardsCompatAnchorProvider extends AnchorProvider {
  publicKey: PublicKey;
}
export abstract class TestUtil {
  public static get provider(): BackwardsCompatAnchorProvider {
    // Needed for WhirlpoolContext.withProvider since its using an older anchor version
    const backwardsCompatAnchorProvider = new BackwardsCompatAnchorProvider(
      TestConfig.default.provider.connection,
      NodeWallet.local(),
      AnchorProvider.defaultOptions(),
    );
    backwardsCompatAnchorProvider.publicKey =
      backwardsCompatAnchorProvider.wallet.publicKey;
    return backwardsCompatAnchorProvider;
  }
}
