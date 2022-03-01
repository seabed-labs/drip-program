import { TestUtil } from "./config";
import { Keypair } from "@solana/web3.js";

export class KeypairUtils extends TestUtil {
  static generatePair(): Keypair {
    return Keypair.generate();
  }

  static generatePairs(count: number): Keypair[] {
    return [...Array(count).keys()].map(this.generatePair);
  }
}
