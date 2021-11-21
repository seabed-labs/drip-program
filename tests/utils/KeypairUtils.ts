import { web3 } from "@project-serum/anchor";
import { TestUtil } from "./config";

export class KeypairUtils extends TestUtil {
  static generatePair(): web3.Keypair {
    return web3.Keypair.generate();
  }

  static generatePairs(count: number): web3.Keypair[] {
    return [...Array(count).keys()].map(this.generatePair);
  }
}