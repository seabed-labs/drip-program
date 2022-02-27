import { Program, web3, workspace } from "@project-serum/anchor";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { DcaVault } from "../../target/types/dca_vault";
import { TestUtil } from "./config";

export class ProgramUtils extends TestUtil {
  static get systemProgram(): typeof web3.SystemProgram {
    return web3.SystemProgram;
  }

  static get vaultProgram(): Program<DcaVault> {
    return workspace.DcaVault as Program<DcaVault>;
  }

  static get tokenProgram(): { programId: web3.PublicKey } {
    return {
      programId: TOKEN_PROGRAM_ID,
    };
  }

  static get associatedTokenProgram(): { programId: web3.PublicKey } {
    return {
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    };
  }
}
