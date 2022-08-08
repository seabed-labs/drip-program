import { AnchorProvider, Provider, setProvider } from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

export class TestConfig {
  public readonly provider: AnchorProvider;
  private static _default = new TestConfig(
    process.env.ENV === "DEVNET"
      ? new AnchorProvider(
          new Connection("https://devnet.genesysgo.net", "confirmed"),
          NodeWallet.local(),
          AnchorProvider.defaultOptions()
        )
      : AnchorProvider.local()
  );

  constructor(provider: AnchorProvider) {
    console.log(process.env.ENV ?? "no environment specified");
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
      AnchorProvider.defaultOptions()
    );
    backwardsCompatAnchorProvider.publicKey =
      backwardsCompatAnchorProvider.wallet.publicKey;
    return backwardsCompatAnchorProvider;
  }
}
