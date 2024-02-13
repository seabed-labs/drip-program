import { Program } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Drip, IDL } from "./idl/drip";
import { TestUtil } from "./config.util";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";

export const DRIP_PROGRAM_ID = "dripTrkvSyQKvkyWg7oi4jmeEGMA5scSYowHArJ9Vwk";

export class ProgramUtil extends TestUtil {
  static get systemProgram(): typeof SystemProgram {
    return SystemProgram;
  }

  static get dripProgram(): Program<Drip> {
    return new Program(IDL, DRIP_PROGRAM_ID, this.provider);
  }

  static get tokenProgram(): { programId: PublicKey } {
    return {
      programId: TOKEN_PROGRAM_ID,
    };
  }

  static get associatedTokenProgram(): { programId: PublicKey } {
    return {
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    };
  }

  static get tokenSwapProgram(): { programId: PublicKey } {
    // https://github.com/solana-labs/solana-program-library/issues/3201
    return {
      programId: new PublicKey("SwapsVeCiPHMUAtzQWZw7RjsKjgCjhwU55QGu4U1Szw"),
    };
  }

  static get orcaWhirlpoolProgram(): { programId: PublicKey } {
    return {
      programId: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"),
    };
  }

  static get rentProgram(): { programId: PublicKey } {
    return {
      programId: SYSVAR_RENT_PUBKEY,
    };
  }

  static get metadataProgram(): { programId: PublicKey } {
    return {
      programId: new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
    };
  }
}
