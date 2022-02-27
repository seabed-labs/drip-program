import { Provider } from "@project-serum/anchor";

export class TestConfig {
  public readonly provider: Provider;
  private static _default = new TestConfig(Provider.local());

  constructor(provider: Provider) {
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
