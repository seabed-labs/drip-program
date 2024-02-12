import "should";
import { initLog } from "../../utils/log.util";
import { before } from "mocha";
import { Mint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { TokenUtil } from "../../utils/token.util";
import { Keypair, PublicKey } from "@solana/web3.js";
import { TestUtil } from "../../utils/config.util";
import { deployVault, deployVaultProtoConfig } from "../../utils/setup.util";
import { findAssociatedTokenAddress } from "../../utils/common.util";
import { VaultUtil } from "../../utils/vault.util";
import { SolUtil } from "../../utils/sol.util";

describe("#withdrawA", () => {
  initLog();

  let tokensAuthority: Keypair;
  let tokenA: Mint, tokenB: Mint;
  let vaultProtoConfig: PublicKey;
  let vault: PublicKey;
  let vaultTokenAAccount: PublicKey, vaultTokenBAccount: PublicKey;

  before(async () => {
    tokensAuthority = Keypair.generate();

    await SolUtil.fundAccount(
      tokensAuthority.publicKey,
      SolUtil.solToLamports(0.1),
    );

    [tokenA, tokenB] = await TokenUtil.createMints(
      [tokensAuthority.publicKey, tokensAuthority.publicKey],
      [6, 9],
    );
  });

  beforeEach(async () => {
    vaultProtoConfig = await deployVaultProtoConfig(
      1,
      5,
      5,
      0,
      TestUtil.provider.publicKey,
    );
    const vaultTreasuryTokenBAccount = await TokenUtil.createTokenAccount(
      tokenB,
      TestUtil.provider.publicKey,
      tokensAuthority,
    );

    const vaultPDA = await deployVault(
      tokenA.address,
      tokenB.address,
      vaultTreasuryTokenBAccount,
      vaultProtoConfig,
    );

    vault = vaultPDA.publicKey;

    [vaultTokenAAccount, vaultTokenBAccount] = await Promise.all([
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.address),
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.address),
    ]);
    await TokenUtil.mintTo({
      payer: tokensAuthority,
      token: tokenA,
      mintAuthority: tokensAuthority,
      recipient: vaultTokenAAccount,
      amount: BigInt(1_000_000_000),
    });
  });

  it("allows admin to withdraw funds to admin's token A account", async () => {
    const adminTokenAccount = await TokenUtil.getOrCreateAssociatedTokenAccount(
      tokenA,
      TestUtil.provider.publicKey,
      tokensAuthority,
    );

    const adminTokenABalanceBefore =
      await TokenUtil.getTokenAccount(adminTokenAccount);
    adminTokenABalanceBefore.amount.toString().should.equal("0");
    await VaultUtil.withdrawA(
      vault,
      vaultTokenAAccount,
      adminTokenAccount,
      vaultProtoConfig,
      TOKEN_PROGRAM_ID,
    );

    const adminTokenABalanceAfter =
      await TokenUtil.getTokenAccount(adminTokenAccount);
    adminTokenABalanceAfter.amount.toString().should.equal("1000000000");
  });

  it("does not allow admin to withdraw funds to admin's token A account", async () => {
    const admin = Keypair.generate();
    await SolUtil.fundAccount(admin.publicKey, SolUtil.solToLamports(0.1));

    const adminTokenAccount = await TokenUtil.getOrCreateAssociatedTokenAccount(
      tokenA,
      admin.publicKey,
      admin,
    );

    const adminTokenABalanceBefore =
      await TokenUtil.getTokenAccount(adminTokenAccount);

    adminTokenABalanceBefore.amount.toString().should.equal("0");

    await VaultUtil.withdrawA(
      vault,
      vaultTokenAAccount,
      adminTokenAccount,
      vaultProtoConfig,
      TOKEN_PROGRAM_ID,
      admin,
    ).should.be.rejectedWith(/0x1785/);

    const adminTokenABalanceAfter =
      await TokenUtil.getTokenAccount(adminTokenAccount);
    adminTokenABalanceAfter.amount.toString().should.equal("0");
  });
});
