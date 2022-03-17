import { DECIMALS, TokenUtil } from "../utils/Token.util";
import { PublicKey, Signer } from "@solana/web3.js";
import { Token, u64 } from "@solana/spl-token";
import { VaultUtil } from "../utils/Vault.util";
import { SolUtils } from "../utils/SolUtils";
import { AccountUtil } from "../utils/Account.util";
import should from "should";
import {
  amount,
  Denom,
  findAssociatedTokenAddress,
  generatePair,
  generatePairs,
  getPositionPDA,
  getVaultPDA,
  getVaultPeriodPDA,
  Granularity,
} from "../utils/common.util";

// TODO: Add tests to check validations later + Finish all embedded todos in code in this file

export async function testDeposit() {
  let vaultProtoConfigPubkey: PublicKey;
  let vaultPubkey: PublicKey;
  let vaultPeriodPubkey: PublicKey;
  let usdcMinter: Signer, btcMinter: Signer, user: Signer;
  let usdc: Token, btc: Token;
  let vaultTokenA_ATA: PublicKey, vaultTokenB_ATA: PublicKey;
  let userBTC_ATA: PublicKey, userUSDC_ATA: PublicKey;

  function tokenAMint(): PublicKey {
    return usdc.publicKey;
  }

  function tokenBMint(): PublicKey {
    return btc.publicKey;
  }

  function userTokenA_ATA(): PublicKey {
    return userUSDC_ATA;
  }

  function userTokenB_ATA(): PublicKey {
    return userBTC_ATA;
  }

  beforeEach(async () => {
    [usdcMinter, btcMinter, user] = generatePairs(3);
    await SolUtils.fundAccount(user.publicKey, SolUtils.solToLamports(10));

    [usdc, btc] = await TokenUtil.createMints(
      [usdcMinter.publicKey, btcMinter.publicKey],
      [DECIMALS.USDC, DECIMALS.BTC]
    );

    const [usdcAmount, btcAmount] = await TokenUtil.scaleAmountBatch(
      [amount(10, Denom.Million), usdc],
      [amount(1, Denom.Thousand), btc]
    );

    [userUSDC_ATA, userBTC_ATA] = await TokenUtil.mintToBatch([
      {
        token: usdc,
        mintAuthority: usdcMinter,
        recipient: user.publicKey,
        amount: usdcAmount,
      },
      {
        token: btc,
        mintAuthority: btcMinter,
        recipient: user.publicKey,
        amount: btcAmount,
      },
    ]);

    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.DAILY,
    });
    vaultProtoConfigPubkey = vaultProtoConfigKeypair.publicKey;

    const vaultPDA = await getVaultPDA(
      tokenAMint(),
      tokenBMint(),
      vaultProtoConfigPubkey
    );

    [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenAMint()),
      findAssociatedTokenAddress(vaultPDA.publicKey, tokenBMint()),
    ]);

    await VaultUtil.initVault(
      vaultPDA.publicKey,
      vaultProtoConfigPubkey,
      tokenAMint(),
      tokenBMint(),
      vaultTokenA_ATA,
      vaultTokenB_ATA
    );

    vaultPubkey = vaultPDA.publicKey;

    const vaultPeriodPDA = await getVaultPeriodPDA(vaultPubkey, 69);

    await VaultUtil.initVaultPeriod(
      vaultPubkey,
      vaultPeriodPDA.publicKey,
      vaultProtoConfigPubkey,
      tokenAMint(),
      tokenBMint(),
      69
    );

    vaultPeriodPubkey = vaultPeriodPDA.publicKey;
  });

  it("happy path (first depositor, vault genesis)", async () => {
    const positionNftMintKeypair = generatePair();
    const positionPDA = await getPositionPDA(positionNftMintKeypair.publicKey);

    const [
      userPositionNft_ATA,
      vaultTokenAAccountBefore,
      userTokenAAccountBefore,
    ] = await Promise.all([
      findAssociatedTokenAddress(
        user.publicKey,
        positionNftMintKeypair.publicKey
      ),
      TokenUtil.fetchTokenAccountInfo(vaultTokenA_ATA),
      TokenUtil.fetchTokenAccountInfo(userTokenA_ATA()),
    ]);

    vaultTokenAAccountBefore.balance.toString().should.equal("0");
    userTokenAAccountBefore.balance.toString().should.equal("10000000000000");

    const depositAmount = await TokenUtil.scaleAmount(
      amount(10, Denom.Thousand),
      usdc
    );

    await usdc.approve(
      userTokenA_ATA(),
      vaultPubkey,
      user.publicKey,
      [user],
      depositAmount
    );

    await VaultUtil.deposit({
      params: {
        tokenADepositAmount: depositAmount,
        dcaCycles: new u64(69),
      },
      accounts: {
        vault: vaultPubkey,
        vaultPeriodEnd: vaultPeriodPubkey,
        userPosition: positionPDA.publicKey,
        tokenAMint: tokenAMint(),
        userPositionNftMint: positionNftMintKeypair.publicKey,
        vaultTokenAAccount: vaultTokenA_ATA,
        userTokenAAccount: userTokenA_ATA(),
        userPositionNftAccount: userPositionNft_ATA,
        depositor: user.publicKey,
      },
      signers: {
        depositor: user,
        userPositionNftMint: positionNftMintKeypair,
      },
    });

    const vaultAccount = await AccountUtil.fetchVaultAccount(vaultPubkey);
    const vaultPeriodEndAccount = await AccountUtil.fetchVaultPeriodAccount(
      vaultPeriodPubkey
    );
    const positionAccount = await AccountUtil.fetchPositionAccount(
      positionPDA.publicKey
    );

    vaultAccount.dripAmount.toString().should.equal("144927536");
    vaultPeriodEndAccount.dar.toString().should.equal("144927536");

    positionAccount.bump.should.equal(positionPDA.bump);
    positionAccount.vault.toBase58().should.equal(vaultPubkey.toBase58());
    positionAccount.positionAuthority
      .toBase58()
      .should.equal(positionNftMintKeypair.publicKey.toBase58());
    positionAccount.isClosed.should.equal(false);
    // TODO(matcha): Figure out how to test timestamp
    //   Some ideas:
    //   - Floor it to 10 seconds check that its valid (easy solution)
    //   - Figure out how to freeze/set the validator clock time to something manually (ideal solution)
    // positionAccount.depositTimestamp.should.equal("")
    positionAccount.dcaPeriodIdBeforeDeposit.toString().should.equal("0");
    positionAccount.periodicDripAmount.toString().should.equal("144927536");
    positionAccount.numberOfSwaps.toString().should.equal("69");
    positionAccount.depositedTokenAAmount
      .toString()
      .should.equal("10000000000");
    positionAccount.withdrawnTokenBAmount.toString().should.equal("0");

    const vaultTokenAAccountAfter = await TokenUtil.fetchTokenAccountInfo(
      vaultTokenA_ATA
    );

    const userTokenAAccountAfter = await TokenUtil.fetchTokenAccountInfo(
      userTokenA_ATA()
    );

    // TODO(matcha): Any other tests to add here? Maybe better to be on the paranoid side and check everything
    vaultTokenAAccountAfter.balance.toString().should.equal("10000000000");
    vaultTokenAAccountAfter.delegatedAmount.toString().should.equal("0");
    userTokenAAccountAfter.balance.toString().should.equal("9990000000000");
    userTokenAAccountAfter.delegatedAmount.toString().should.equal("0");

    const userPositionNftMintAccount = await TokenUtil.fetchTokenMintInfo(
      positionNftMintKeypair.publicKey
    );

    await TokenUtil.fetchTokenMintInfo(usdc.publicKey);

    should(userPositionNftMintAccount.mintAuthority).be.null();
    should(userPositionNftMintAccount.freezeAuthority).be.null();
    userPositionNftMintAccount.supply.toString().should.equal("1");
    userPositionNftMintAccount.decimals.toString().should.equal("0");
    userPositionNftMintAccount.isInitialized.should.equal(1);

    const userPositionNftTokenAccount = await TokenUtil.fetchTokenAccountInfo(
      userPositionNft_ATA
    );

    userPositionNftTokenAccount.owner
      .toBase58()
      .should.equal(user.publicKey.toBase58());
    userPositionNftTokenAccount.delegatedAmount.toString().should.equal("0");
    userPositionNftTokenAccount.balance.toString().should.equal("1");
    userPositionNftTokenAccount.address
      .toBase58()
      .should.equal(userPositionNft_ATA.toBase58());
    // TODO(matcha): We should probably assign close authority to user WHEN THEY WITHDRAW so that they can close the account
    should(userPositionNftTokenAccount.closeAuthority).be.null();
    // TODO(matcha): Should we just check every single property in the account? First need to understand what they are
  });
}
