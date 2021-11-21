import { web3 } from "@project-serum/anchor";
import { TestUtil } from "./config";

export class AccountUtils extends TestUtil {
  static async fetchAccountData(pubkey: web3.PublicKey): Promise<Buffer> {
    const account = await this.provider.connection.getAccountInfo(pubkey);
    return account.data;
  }
}