import "should";
import { initLog } from "../../utils/log.util";
import { before } from "mocha";
import { Mint } from "@solana/spl-token";
import { TokenUtil } from "../../utils/token.util";
import { Keypair, PublicKey } from "@solana/web3.js";
import { TestUtil } from "../../utils/config.util";
import { deployVault, deployVaultProtoConfig } from "../../utils/setup.util";
import { findAssociatedTokenAddress } from "../../utils/common.util";
import { VaultUtil } from "../../utils/vault.util";
import { SolUtil } from "../../utils/sol.util";

describe("#adminWithdraw", () => {
  initLog();

  let tokensAuthority: Keypair;
  let vaultAdmin: Keypair;
  let tokenA: Mint, tokenB: Mint;
  let vaultProtoConfig: PublicKey;
  let vault: PublicKey;
  let vaultTokenAAccount: PublicKey, vaultTokenBAccount: PublicKey;

  before(async () => {
    tokensAuthority = Keypair.generate();
    vaultAdmin = Keypair.generate();

    await SolUtil.fundAccount(
      tokensAuthority.publicKey,
      SolUtil.solToLamports(0.1),
    );
    await SolUtil.fundAccount(vaultAdmin.publicKey, SolUtil.solToLamports(0.1));

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
      vaultAdmin.publicKey,
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
      undefined,
      vaultAdmin,
    );

    vault = vaultPDA.publicKey;
    vaultTokenAAccount = await findAssociatedTokenAddress(
      vaultPDA.publicKey,
      tokenA.address,
    );
    vaultTokenBAccount = await findAssociatedTokenAddress(
      vaultPDA.publicKey,
      tokenB.address,
    );
    await TokenUtil.mintTo({
      payer: tokensAuthority,
      token: tokenA,
      mintAuthority: tokensAuthority,
      recipient: vaultTokenAAccount,
      amount: BigInt(1_000_000_000),
    });
    await TokenUtil.mintTo({
      payer: tokensAuthority,
      token: tokenB,
      mintAuthority: tokensAuthority,
      recipient: vaultTokenBAccount,
      amount: BigInt(1_000_000_000),
    });
  });

  it("allows admin to withdraw funds to admin's token B account", async () => {
    const adminTokenAccount = await TokenUtil.getOrCreateAssociatedTokenAccount(
      tokenB,
      vaultAdmin.publicKey,
      tokensAuthority,
    );
    const adminTokenBBalanceBefore =
      await TokenUtil.getTokenAccount(adminTokenAccount);
    adminTokenBBalanceBefore.amount.toString().should.equal("0");
    await VaultUtil.adminWithdraw(
      vault,
      vaultTokenBAccount,
      adminTokenAccount,
      vaultProtoConfig,
      vaultAdmin,
    );
    const adminTokenBBalanceAfter =
      await TokenUtil.getTokenAccount(adminTokenAccount);
    adminTokenBBalanceAfter.amount.toString().should.equal("1000000000");
  });

  it("allows admin to withdraw funds to admin's token A account", async () => {
    const adminTokenAccount = await TokenUtil.getOrCreateAssociatedTokenAccount(
      tokenA,
      vaultAdmin.publicKey,
      tokensAuthority,
    );
    const adminTokenABalanceBefore =
      await TokenUtil.getTokenAccount(adminTokenAccount);
    adminTokenABalanceBefore.amount.toString().should.equal("0");
    await VaultUtil.adminWithdraw(
      vault,
      vaultTokenAAccount,
      adminTokenAccount,
      vaultProtoConfig,
      vaultAdmin,
    );
    const adminTokenABalanceAfter =
      await TokenUtil.getTokenAccount(adminTokenAccount);
    adminTokenABalanceAfter.amount.toString().should.equal("1000000000");
  });

  it("does not allow non-admin to withdraw", async () => {
    const adminTokenAccount = await TokenUtil.getOrCreateAssociatedTokenAccount(
      tokenB,
      vaultAdmin.publicKey,
      tokensAuthority,
    );
    await VaultUtil.adminWithdraw(
      vault,
      vaultTokenBAccount,
      adminTokenAccount,
      vaultProtoConfig,
      tokensAuthority,
    ).should.be.rejectedWith(/0x1785/);
  });
});
