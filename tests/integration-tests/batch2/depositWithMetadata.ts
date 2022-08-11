import "should";
import { DECIMALS, TokenUtil } from "../../utils/token.util";
import { PublicKey, Signer } from "@solana/web3.js";
import { Token, u64 } from "@solana/spl-token";
import { VaultUtil } from "../../utils/vault.util";
import { SolUtil } from "../../utils/sol.util";
import { AccountUtil } from "../../utils/account.util";
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
} from "../../utils/common.util";
import { initLog } from "../../utils/log.util";
import { PDAUtil } from "@orca-so/whirlpools-sdk";

// TODO: Add tests to check validations later + Finish all embedded todos in code in this file
describe("#depositWithMetadata", testDepositWithMetadata);

export function testDepositWithMetadata() {
  initLog();

  let vaultProtoConfigPubkey: PublicKey;
  let vaultPubkey: PublicKey;
  let vaultPeriodPubkey: PublicKey;
  let usdcMinter: Signer, btcMinter: Signer, user: Signer;
  let tokenA: Token;
  let tokenB: Token;
  let vaultTokenAAccount: PublicKey;
  let vaultTokenBAccount: PublicKey;
  let vaultTreasuryTokenBAccount: PublicKey;
  let userTokenAAccount: PublicKey;

  beforeEach(async () => {
    const treasuryOwner = generatePair();
    [usdcMinter, btcMinter, user] = generatePairs(3);
    await Promise.all([
      SolUtil.fundAccount(user.publicKey, SolUtil.solToLamports(1)),
      SolUtil.fundAccount(treasuryOwner.publicKey, SolUtil.solToLamports(1)),
    ]);

    [tokenA, tokenB] = await TokenUtil.createMints(
      [usdcMinter.publicKey, btcMinter.publicKey],
      [DECIMALS.USDC, DECIMALS.BTC]
    );

    const [usdcAmount] = await TokenUtil.scaleAmountBatch([
      amount(10, Denom.Million),
      tokenA,
    ]);

    [userTokenAAccount] = await TokenUtil.mintToBatch([
      {
        token: tokenA,
        mintAuthority: usdcMinter,
        recipient: user.publicKey,
        amount: usdcAmount,
      },
    ]);

    const vaultProtoConfigKeypair = generatePair();
    await VaultUtil.initVaultProtoConfig(vaultProtoConfigKeypair, {
      granularity: Granularity.DAILY,
      tokenADripTriggerSpread: 5,
      tokenBWithdrawalSpread: 5,
      admin: generatePair().publicKey,
    });
    vaultProtoConfigPubkey = vaultProtoConfigKeypair.publicKey;

    const vaultPDA = await getVaultPDA(
      tokenA.publicKey,
      tokenB.publicKey,
      vaultProtoConfigPubkey
    );

    [vaultTokenAAccount, vaultTokenBAccount, vaultTreasuryTokenBAccount] =
      await Promise.all([
        findAssociatedTokenAddress(vaultPDA.publicKey, tokenA.publicKey),
        findAssociatedTokenAddress(vaultPDA.publicKey, tokenB.publicKey),
        TokenUtil.createTokenAccount(tokenB, treasuryOwner.publicKey),
      ]);
    await VaultUtil.initVault(
      vaultPDA.publicKey,
      vaultProtoConfigPubkey,
      tokenA.publicKey,
      tokenB.publicKey,
      vaultTokenAAccount,
      vaultTokenBAccount,
      vaultTreasuryTokenBAccount,
      undefined
    );

    vaultPubkey = vaultPDA.publicKey;

    const vaultPeriodPDA = await getVaultPeriodPDA(vaultPubkey, 69);

    await VaultUtil.initVaultPeriod(
      vaultPubkey,
      vaultPeriodPDA.publicKey,
      vaultProtoConfigPubkey,
      tokenA.publicKey,
      tokenB.publicKey,
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
      TokenUtil.fetchTokenAccountInfo(vaultTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(userTokenAAccount),
    ]);

    vaultTokenAAccountBefore.balance.toString().should.equal("0");
    userTokenAAccountBefore.balance.toString().should.equal("10000000000000");

    const depositAmount = await TokenUtil.scaleAmount(
      amount(10, Denom.Thousand),
      tokenA
    );

    await tokenA.approve(
      userTokenAAccount,
      vaultPubkey,
      user.publicKey,
      [user],
      depositAmount
    );

    await VaultUtil.depositWithMetadata({
      params: {
        tokenADepositAmount: depositAmount,
        numberOfSwaps: new u64(69),
      },
      accounts: {
        vault: vaultPubkey,
        vaultPeriodEnd: vaultPeriodPubkey,
        userPosition: positionPDA.publicKey,
        tokenAMint: tokenA.publicKey,
        userPositionNftMint: positionNftMintKeypair.publicKey,
        vaultTokenAAccount: vaultTokenAAccount,
        userTokenAAccount: userTokenAAccount,
        userPositionNftAccount: userPositionNft_ATA,
        depositor: user.publicKey,
        positionMetadataAccount: PDAUtil.getPositionMetadata(
          positionNftMintKeypair.publicKey
        ).publicKey,
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
    positionAccount.dripPeriodIdBeforeDeposit.toString().should.equal("0");
    positionAccount.periodicDripAmount.toString().should.equal("144927536");
    positionAccount.numberOfSwaps.toString().should.equal("69");
    positionAccount.depositedTokenAAmount
      .toString()
      .should.equal("10000000000");
    positionAccount.withdrawnTokenBAmount.toString().should.equal("0");

    const vaultTokenAAccountAfter = await TokenUtil.fetchTokenAccountInfo(
      vaultTokenAAccount
    );

    const userTokenAAccountAfter = await TokenUtil.fetchTokenAccountInfo(
      userTokenAAccount
    );

    // TODO(matcha): Any other tests to add here? Maybe better to be on the paranoid side and check everything
    vaultTokenAAccountAfter.balance.toString().should.equal("10000000000");
    vaultTokenAAccountAfter.delegatedAmount.toString().should.equal("0");
    userTokenAAccountAfter.balance.toString().should.equal("9990000000000");
    userTokenAAccountAfter.delegatedAmount.toString().should.equal("0");

    const userPositionNftMintAccount = await TokenUtil.fetchTokenMintInfo(
      positionNftMintKeypair.publicKey
    );

    await TokenUtil.fetchTokenMintInfo(tokenA.publicKey);

    (userPositionNftMintAccount.mintAuthority == null).should.be.true();
    (userPositionNftMintAccount.freezeAuthority == null).should.be.true();
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
    (userPositionNftTokenAccount.closeAuthority == null).should.be.true();
    // TODO(matcha): Should we just check every single property in the account? First need to understand what they are
  });
}