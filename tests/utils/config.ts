import { Provider, setProvider } from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { Connection } from "@solana/web3.js";

export class TestConfig {
  public readonly provider: Provider;
  private static _default = new TestConfig(
    process.env.ENV === "DEVNET"
      ? new Provider(
          new Connection("https://api.devnet.solana.com", "confirmed"),
          NodeWallet.local(),
          Provider.defaultOptions()
        )
      : Provider.local()
  );

  constructor(provider: Provider) {
    console.log(process.env.ENV);
    setProvider(provider);
    this.provider = provider;
  }

  static get default(): TestConfig {
    return TestConfig._default;
  }
}

export abstract class TestUtil {
  public static get provider(): Provider {
    return TestConfig.default.provider;
  }
}
