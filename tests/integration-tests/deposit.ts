import { KeypairUtils } from "../utils/KeypairUtils";
import { DECIMALS, TokenUtils } from "../utils/TokenUtils";
import { amount, Denom } from "../utils/amount";
import { PublicKey, Signer } from "@solana/web3.js";
import { Token, u64 } from "@solana/spl-token";
import { VaultUtils } from "../utils/VaultUtils";
import { Granularity } from "../utils/Granularity";
import { PDAUtils } from "../utils/PDAUtils";
import "should";
import { SolUtils } from "../utils/SolUtils";
import { AccountUtils } from "../utils/AccountUtils";

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
    [usdcMinter, btcMinter, user] = KeypairUtils.generatePairs(3);
    await SolUtils.fundAccount(user.publicKey, SolUtils.solToLamports(10));

    [usdc, btc] = await TokenUtils.createMints(
      [usdcMinter.publicKey, btcMinter.publicKey],
      [DECIMALS.USDC, DECIMALS.BTC]
    );

    const [usdcAmount, btcAmount] = await TokenUtils.scaleAmountBatch(
      [amount(10, Denom.Million), usdc],
      [amount(1, Denom.Thousand), btc]
    );

    [userUSDC_ATA, userBTC_ATA] = await TokenUtils.mintToBatch([
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

    const vaultProtoConfigKeypair = KeypairUtils.generatePair();
    await VaultUtils.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.DAILY,
    });
    vaultProtoConfigPubkey = vaultProtoConfigKeypair.publicKey;

    const vaultPDA = await PDAUtils.getVaultPDA(
      tokenAMint(),
      tokenBMint(),
      vaultProtoConfigPubkey
    );

    [vaultTokenA_ATA, vaultTokenB_ATA] = await Promise.all([
      PDAUtils.findAssociatedTokenAddress(vaultPDA.pubkey, tokenAMint()),
      PDAUtils.findAssociatedTokenAddress(vaultPDA.pubkey, tokenBMint()),
    ]);

    await VaultUtils.initVault(
      vaultPDA.pubkey,
      vaultProtoConfigPubkey,
      tokenAMint(),
      tokenBMint(),
      vaultTokenA_ATA,
      vaultTokenB_ATA
    );

    vaultPubkey = vaultPDA.pubkey;

    const vaultPeriodPDA = await PDAUtils.getVaultPeriodPDA(vaultPubkey, 69);

    await VaultUtils.initVaultPeriod(
      vaultPubkey,
      vaultPeriodPDA.pubkey,
      vaultProtoConfigPubkey,
      tokenAMint(),
      tokenBMint(),
      69
    );

    vaultPeriodPubkey = vaultPeriodPDA.pubkey;
  });

  it("happy path (first depositor, vault genesis)", async () => {
    const positionNftMintKeypair = KeypairUtils.generatePair();
    const positionPDA = await PDAUtils.getPositionPDA(
      vaultPubkey,
      positionNftMintKeypair.publicKey
    );

    const userPositionNft_ATA = await PDAUtils.findAssociatedTokenAddress(
      user.publicKey,
      positionNftMintKeypair.publicKey
    );

    const vaultTokenAAccountBefore = await TokenUtils.fetchTokenAccountInfo(
      vaultTokenA_ATA
    );

    const userTokenAAccountBefore = await TokenUtils.fetchTokenAccountInfo(
      userTokenA_ATA()
    );

    vaultTokenAAccountBefore.balance.toString().should.equal("0");
    userTokenAAccountBefore.balance.toString().should.equal("10000000000000");

    const depositAmount = await TokenUtils.scaleAmount(
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

    await VaultUtils.deposit({
      params: {
        tokenADepositAmount: depositAmount,
        dcaCycles: new u64(69),
      },
      accounts: {
        vault: vaultPubkey,
        vaultPeriodEnd: vaultPeriodPubkey,
        userPosition: positionPDA.pubkey,
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

    const [vaultAccount, vaultPeriodEndAccount, positionAccount] =
      await Promise.all([
        AccountUtils.fetchVaultAccount(vaultPubkey),
        AccountUtils.fetchVaultPeriodAccount(vaultPeriodPubkey),
        AccountUtils.fetchPositionAccount(positionPDA.pubkey),
      ]);
    vaultAccount.dripAmount.toString().should.equal("144927536");
    vaultPeriodEndAccount.dar.toString().should.equal("144927536");
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

    const vaultTokenAAccountAfter = await TokenUtils.fetchTokenAccountInfo(
      vaultTokenA_ATA
    );

    const userTokenAAccountAfter = await TokenUtils.fetchTokenAccountInfo(
      userTokenA_ATA()
    );

    // TODO(matcha): Any other tests to add here? Maybe better to be on the paranoid side and check everything
    vaultTokenAAccountAfter.balance.toString().should.equal("10000000000");
    vaultTokenAAccountAfter.delegatedAmount.toString().should.equal("0");
    userTokenAAccountAfter.balance.toString().should.equal("9990000000000");
    userTokenAAccountAfter.delegatedAmount.toString().should.equal("0");

    const userPositionNftMintAccount = await TokenUtils.fetchTokenMintInfo(
      positionNftMintKeypair.publicKey
    );

    console.log("VAULT", vaultPubkey.toBase58());
    console.log(
      "NFT MINT AUTHORITY",
      userPositionNftMintAccount.mintAuthority.toBase58()
    );
    userPositionNftMintAccount.mintAuthority.toBase58().should.equal(null);
    userPositionNftMintAccount.freezeAuthority.should.equal(null);
    userPositionNftMintAccount.supply.toString().should.equal("1");
    userPositionNftMintAccount.decimals.toString().should.equal("0");
    userPositionNftMintAccount.isInitialized.should.equal(true);

    const userPositionNftTokenAccount = await TokenUtils.fetchTokenAccountInfo(
      userPositionNft_ATA
    );

    userPositionNftTokenAccount.owner
      .toBase58()
      .should.equal(user.publicKey.toBase58());
    userPositionNftTokenAccount.delegate.should.equal(null);
    userPositionNftTokenAccount.delegatedAmount.toString().should.equal("0");
    userPositionNftTokenAccount.balance.toString().should.equal("1");
    userPositionNftTokenAccount.address
      .toBase58()
      .should.equal(userPositionNft_ATA.toBase58());
    userPositionNftTokenAccount.isInitialized.should.equal(true);
    // TODO(matcha): We should probably assign close authority to user WHEN THEY WITHDRAW so that they can close the account
    userPositionNftTokenAccount.closeAuthority.should.equal(null);
    // TODO(matcha): Should we just check every single property in the account? First need to understand what they are
  });
}
