import { web3, BN } from "@project-serum/anchor";
import { expect } from "chai";
import { TestUtil } from "./config";

export class ExpectUtils extends TestUtil {
  static expectPubkeysToBeEqual(a: web3.PublicKey, b: web3.PublicKey) {
    expect(a.toBase58()).to.be.equal(b.toBase58());
  } 

  static batchExpectPubkeysToBeEqual(...keys: [web3.PublicKey, web3.PublicKey][]) {
    keys.forEach(([actual, expected]) => {
      this.expectPubkeysToBeEqual(actual, expected);
    });
  }

  static expectBNToEqual(actual: BN, expected: number | BN | string) {
    expect(actual.toString()).to.be.equal(expected.toString());
  }
}