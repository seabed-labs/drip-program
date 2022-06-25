import { AnchorProvider, Provider, setProvider } from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { Connection } from "@solana/web3.js";

export class TestConfig {
  public readonly provider: AnchorProvider;
  private static _default = new TestConfig(
    process.env.ENV === "DEVNET"
      ? new AnchorProvider(
          new Connection("https://api.devnet.solana.com", "confirmed"),
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

export abstract class TestUtil {
  public static get provider(): AnchorProvider {
    return TestConfig.default.provider;
  }
}
