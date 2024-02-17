import "should";
import { SolUtil } from "../../utils/sol.util";
import { TokenUtil } from "../../utils/token.util";
import {
  amount,
  Denom,
  findAssociatedTokenAddress,
  generatePair,
  generatePairs,
} from "../../utils/common.util";
import {
  closePositionWrapper,
  deployVault,
  deployVaultPeriod,
  deployVaultProtoConfig,
  depositToVault,
  sleep,
} from "../../utils/setup.util";
import { Keypair, PublicKey } from "@solana/web3.js";
import { AccountUtil } from "../../utils/account.util";
import { initLog } from "../../utils/log.util";
import { VaultUtil } from "../../utils/vault.util";
import { TestUtil } from "../../utils/config.util";

describe("#close", testCloseActions);

function testCloseActions() {
  initLog();

  let payerKeypair: Keypair;
  let vaultAdminKeypair: Keypair;

  let vaultProtoConfig: PublicKey;
  let vault: PublicKey;
  let vaultPeriods: PublicKey[];
  let vaultTokenAAccount: PublicKey;
  let vaultTokenBAccount: PublicKey;

  let closePosition: ReturnType<typeof closePositionWrapper>;

  beforeEach(async () => {
    // https://discord.com/channels/889577356681945098/889702325231427584/910244405443715092
    // sleep to progress to the next block
    await sleep(500);
    const user = generatePair();
    const tokenOwnerKeypair = generatePair();
    [payerKeypair, vaultAdminKeypair] = generatePairs(4);
    await Promise.all([
      SolUtil.fundAccount(user.publicKey, SolUtil.solToLamports(0.1)),
      SolUtil.fundAccount(payerKeypair.publicKey, SolUtil.solToLamports(0.1)),
      SolUtil.fundAccount(
        tokenOwnerKeypair.publicKey,
        SolUtil.solToLamports(0.1),
      ),
      SolUtil.fundAccount(
        vaultAdminKeypair.publicKey,
        SolUtil.solToLamports(0.1),
      ),
    ]);

    const tokenA = await TokenUtil.createMint(
      tokenOwnerKeypair.publicKey,
      null,
      6,
      payerKeypair,
    );

    const tokenB = await TokenUtil.createMint(
      tokenOwnerKeypair.publicKey,
      null,
      6,
      payerKeypair,
    );

    vaultProtoConfig = await deployVaultProtoConfig(
      1,
      5,
      5,
      0,
      vaultAdminKeypair.publicKey,
    );

    const vaultTreasuryTokenBAccount = await TokenUtil.createTokenAccount(
      tokenB,
      payerKeypair.publicKey,
      payerKeypair,
    );

    vault = (
      await deployVault(
        tokenA.address,
        tokenB.address,
        vaultTreasuryTokenBAccount,
        vaultProtoConfig,
        undefined,
        vaultAdminKeypair,
      )
    ).publicKey;

    [vaultTokenAAccount, vaultTokenBAccount] = await Promise.all([
      findAssociatedTokenAddress(vault, tokenA.address),
      findAssociatedTokenAddress(vault, tokenB.address),
    ]);

    vaultPeriods = (
      await Promise.all(
        [...Array(6).keys()].map((i) =>
          deployVaultPeriod(
            vaultProtoConfig,
            vault,
            tokenA.address,
            tokenB.address,
            i,
          ),
        ),
      )
    ).map((pda) => pda.publicKey);

    const userTokenAAccount = await TokenUtil.getOrCreateAssociatedTokenAccount(
      tokenA,
      user.publicKey,
      user,
    );
    const mintAmount = TokenUtil.scaleAmount(amount(2, Denom.Thousand), tokenA);
    await TokenUtil.mintTo({
      payer: user,
      token: tokenA,
      mintAuthority: tokenOwnerKeypair,
      recipient: userTokenAAccount,
      amount: mintAmount,
    });

    const userTokenBAccount = await TokenUtil.getOrCreateAssociatedTokenAccount(
      tokenB,
      user.publicKey,
      user,
    );

    const depositAmount = TokenUtil.scaleAmount(
      amount(1, Denom.Thousand),
      tokenA,
    );
    const [userPositionNFTMint, userPositionAccount, userPositionNFTAccount] =
      await depositToVault(
        user,
        tokenA,
        depositAmount,
        BigInt(4),
        vault,
        vaultPeriods[4],
        userTokenAAccount,
        vaultTreasuryTokenBAccount,
      );

    closePosition = closePositionWrapper(
      user,
      vault,
      vaultProtoConfig,
      userPositionAccount,
      vaultTokenAAccount,
      vaultTokenBAccount,
      vaultTreasuryTokenBAccount,
      userTokenAAccount,
      userTokenBAccount,
      userPositionNFTAccount,
      userPositionNFTMint,
    );
  });

  describe("#closeVaultPeriod", () => {
    it("should not be able to close vault period if signer is not admin", async () => {
      await VaultUtil.closeVaultPeriod(
        payerKeypair,
        vault,
        vaultProtoConfig,
        vaultPeriods[0],
        vaultAdminKeypair.publicKey,
      ).should.be.rejectedWith(/0x177a/);
    });

    it("should not be able to close vault period if vault still has drip amount", async () => {
      await VaultUtil.closeVaultPeriod(
        vaultAdminKeypair,
        vault,
        vaultProtoConfig,
        vaultPeriods[0],
        vaultAdminKeypair.publicKey,
      ).should.be.rejectedWith(/0x178e/);
    });

    it("should be able to close all vault periods after closing position", async () => {
      const solDestBefore = await TestUtil.provider.connection.getAccountInfo(
        vaultAdminKeypair.publicKey,
      );
      const [i, j, k] = [0, 0, 4];
      await closePosition(vaultPeriods[i], vaultPeriods[j], vaultPeriods[k]);
      for (let i = 0; i < vaultPeriods.length; i++) {
        await VaultUtil.closeVaultPeriod(
          vaultAdminKeypair,
          vault,
          vaultProtoConfig,
          vaultPeriods[i],
          vaultAdminKeypair.publicKey,
        );
        await AccountUtil.fetchVaultPeriodAccount(
          vaultPeriods[i],
        ).should.be.rejectedWith(/Account does not exist or has no data/);

        const solDestAfter = await TestUtil.provider.connection.getAccountInfo(
          vaultAdminKeypair.publicKey,
        );
        (solDestAfter.lamports > solDestBefore.lamports).should.be.true();
      }
    });
  });

  describe("#closeVault", () => {
    it("should not be able to close vault if signer is not the vault admin", async () => {
      await VaultUtil.closeVault(
        payerKeypair,
        vault,
        vaultProtoConfig,
        vaultTokenAAccount,
        vaultTokenBAccount,
        vaultAdminKeypair.publicKey,
      ).should.be.rejectedWith(/0x177a/);
    });

    it("should not be able to close vault if drip_amount is not 0", async () => {
      const solDestBefore = await TestUtil.provider.connection.getAccountInfo(
        vaultAdminKeypair.publicKey,
      );
      await VaultUtil.closeVault(
        vaultAdminKeypair,
        vault,
        vaultProtoConfig,
        vaultTokenAAccount,
        vaultTokenBAccount,
        vaultAdminKeypair.publicKey,
      ).should.be.rejectedWith(/0x178e/);

      const solDestAfter = await TestUtil.provider.connection.getAccountInfo(
        vaultAdminKeypair.publicKey,
      );
      (solDestAfter.lamports === solDestBefore.lamports).should.be.true();
    });

    it("should be able to close vault", async () => {
      const solDestBefore = await TestUtil.provider.connection.getAccountInfo(
        vaultAdminKeypair.publicKey,
      );

      const [i, j, k] = [0, 0, 4];
      await closePosition(vaultPeriods[i], vaultPeriods[j], vaultPeriods[k]);
      await VaultUtil.closeVault(
        vaultAdminKeypair,
        vault,
        vaultProtoConfig,
        vaultTokenAAccount,
        vaultTokenBAccount,
        vaultAdminKeypair.publicKey,
      );

      await AccountUtil.fetchVaultAccount(vault).should.be.rejectedWith(
        /Account does not exist or has no data/,
      );
      (
        (await TestUtil.provider.connection.getAccountInfo(
          vaultTokenAAccount,
        )) === null
      ).should.be.true();
      (
        (await TestUtil.provider.connection.getAccountInfo(
          vaultTokenBAccount,
        )) === null
      ).should.be.true();
      const solDestAfter = await TestUtil.provider.connection.getAccountInfo(
        vaultAdminKeypair.publicKey,
      );
      (solDestAfter.lamports > solDestBefore.lamports).should.be.true();
    });
  });

  describe("#closeVaultProtoConfig", () => {
    it("should not be able to close vault proto config if signer is not the vault admin", async () => {
      await VaultUtil.closeVaultProtoConfig(
        payerKeypair,
        vaultProtoConfig,
        vaultAdminKeypair.publicKey,
      ).should.be.rejectedWith(/0x177a/);
    });

    it("should be able to close vault proto config", async () => {
      const solDestBefore = await TestUtil.provider.connection.getAccountInfo(
        vaultAdminKeypair.publicKey,
      );
      const [i, j, k] = [0, 0, 4];
      await closePosition(vaultPeriods[i], vaultPeriods[j], vaultPeriods[k]);
      await VaultUtil.closeVaultProtoConfig(
        vaultAdminKeypair,
        vaultProtoConfig,
        vaultAdminKeypair.publicKey,
      );
      await AccountUtil.fetchVaultProtoConfigAccount(
        vaultProtoConfig,
      ).should.be.rejectedWith(/Account does not exist or has no data/);
      const solDestAfter = await TestUtil.provider.connection.getAccountInfo(
        vaultAdminKeypair.publicKey,
      );
      (solDestAfter.lamports > solDestBefore.lamports).should.be.true();
    });
  });
}
