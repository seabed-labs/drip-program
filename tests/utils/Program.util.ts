import { Program, workspace } from "@project-serum/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Drip } from "../../target/types/drip";
import { TestUtil } from "./config";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_SWAP_PROGRAM_ID } from "@solana/spl-token-swap";

export class ProgramUtil extends TestUtil {
  static get systemProgram(): typeof SystemProgram {
    return SystemProgram;
  }

  static get dripProgram(): Program<Drip> {
    return workspace.Drip as Program<Drip>;
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
    return {
      programId: TOKEN_SWAP_PROGRAM_ID,
    };
  }

  static get rentProgram(): { programId: PublicKey } {
    return {
      programId: SYSVAR_RENT_PUBKEY,
    };
  }
}
