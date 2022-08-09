import "should";
import { SolUtil } from "./sol.util";
import { TokenUtil } from "./token.util";
import { Keypair, PublicKey } from "@solana/web3.js";
import { WhirlpoolUtil } from "./whirlpool.util";
import { deriveATA, Percentage } from "@orca-so/common-sdk";
import Decimal from "decimal.js";
import {
  buildWhirlpoolClient,
  increaseLiquidityQuoteByInputToken,
  PDAUtil,
  TICK_ARRAY_SIZE,
  toTx,
  WhirlpoolIx,
} from "@orca-so/whirlpools-sdk";
import { ProgramUtil } from "./program.util";
import { amount, Denom } from "./common.util";

describe("#setupWhirlpool", setupWhirlpool);

export function setupWhirlpool() {
  before(async () => {
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
    const btcPositionMetadataAccount =
      PDAUtil.getPositionMetadata(btcPubkey).publicKey;
  });

  it("setup whirlpool", async () => {
    true.should.be.true();
  });
}
