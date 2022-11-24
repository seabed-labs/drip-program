import { Keypair, PublicKey } from "@solana/web3.js";
import { Token, u64 } from "@solana/spl-token";
import { DeployVaultRes, DripUtil } from "../../utils/drip.util";
import {
  deploySPLTokenSwap,
  depositToVault,
  dripSPLTokenSwapWrapper,
  DripSPLTokenSwapWrapper,
  sleep,
} from "../../utils/setup.util";
import {
  amount,
  Denom,
  generatePair,
  generatePairs,
} from "../../utils/common.util";
import { SolUtil } from "../../utils/sol.util";
import { TokenUtil } from "../../utils/token.util";
import { AccountUtil } from "../../utils/account.util";
import { ProgramUtil } from "../../utils/program.util";

export function testDripSPLTokenSwap(beforeEach: any) {
  let tokenOwnerKeypair: Keypair;
  let payerKeypair: Keypair;

  let userKeypair: Keypair;

  let tokenA: Token;
  let tokenB: Token;

  let deployVaultRes: DeployVaultRes;

  // tokenA -> token B swap
  let swap: PublicKey;
  let swapTokenMint: PublicKey;
  let swapTokenAAccount: PublicKey;
  let swapTokenBAccount: PublicKey;
  let swapFeeAccount: PublicKey;
  let swapAuthority: PublicKey;

  // tokenB -> tokenA swap
  let swap2: PublicKey;
  let swapTokenMint2: PublicKey;
  let swapTokenAAccount2: PublicKey;
  let swapTokenBAccount2: PublicKey;
  let swapFeeAccount2: PublicKey;
  let swapAuthority2: PublicKey;

  // Non-whitelisted tokenA -> tokenB swap
  let swap3: PublicKey;
  let swapTokenMint3: PublicKey;
  let swapTokenAAccount3: PublicKey;
  let swapTokenBAccount3: PublicKey;
  let swapFeeAccount3: PublicKey;
  let swapAuthority3: PublicKey;

  let dripTrigger: DripSPLTokenSwapWrapper;
  before(async () => {});

  beforeEach(async () => {
    // https://discord.com/channels/889577356681945098/889702325231427584/910244405443715092
    // sleep to progress to the next block
    await sleep(500);
    [tokenOwnerKeypair, payerKeypair, userKeypair] = generatePairs(3);
    await Promise.all([
      SolUtil.fundAccount(userKeypair.publicKey, SolUtil.solToLamports(0.1)),
      SolUtil.fundAccount(payerKeypair.publicKey, SolUtil.solToLamports(0.1)),
      SolUtil.fundAccount(
        tokenOwnerKeypair.publicKey,
        SolUtil.solToLamports(0.1)
      ),
    ]);
    [tokenA, tokenB] = await Promise.all([
      await TokenUtil.createMint(
        tokenOwnerKeypair.publicKey,
        null,
        6,
        payerKeypair
      ),
      await TokenUtil.createMint(
        tokenOwnerKeypair.publicKey,
        null,
        6,
        payerKeypair
      ),
    ]);

    [
      swap,
      swapTokenMint,
      swapTokenAAccount,
      swapTokenBAccount,
      swapFeeAccount,
      swapAuthority,
    ] = await deploySPLTokenSwap(
      tokenA,
      tokenOwnerKeypair,
      tokenB,
      tokenOwnerKeypair,
      payerKeypair
    );

    [
      swap2,
      swapTokenMint2,
      swapTokenAAccount2,
      swapTokenBAccount2,
      swapFeeAccount2,
      swapAuthority2,
    ] = await deploySPLTokenSwap(
      tokenB,
      tokenOwnerKeypair,
      tokenA,
      tokenOwnerKeypair,
      payerKeypair
    );

    [
      swap3,
      swapTokenMint3,
      swapTokenAAccount3,
      swapTokenBAccount3,
      swapFeeAccount3,
      swapAuthority3,
    ] = await deploySPLTokenSwap(
      tokenA,
      tokenOwnerKeypair,
      tokenB,
      tokenOwnerKeypair,
      payerKeypair
    );
    deployVaultRes = await DripUtil.deployVaultAndCreatePosition({
      tokenA,
      tokenB,
      userKeypair,
      tokenOwnerKeypair,
      whitelistedSwaps: [swap, swap2],
    });

    const depositAmount = await TokenUtil.scaleAmount(
      amount(1, Denom.Thousand),
      tokenA
    );
    await depositToVault(
      userKeypair,
      tokenA,
      depositAmount,
      new u64(4),
      deployVaultRes.vault,
      deployVaultRes.vaultPeriods[4],
      deployVaultRes.userTokenAAccount,
      deployVaultRes.vaultTreasuryTokenBAccount
    );

    dripTrigger = dripSPLTokenSwapWrapper(
      deployVaultRes.botKeypair,
      deployVaultRes.botTokenAAcount,
      deployVaultRes.vault,
      deployVaultRes.vaultProtoConfig,
      deployVaultRes.vaultTokenAAccount,
      deployVaultRes.vaultTokenBAccount,
      swapTokenMint,
      swapTokenAAccount,
      swapTokenBAccount,
      swapFeeAccount,
      swapAuthority,
      swap
    );
  });

  it("should trigger drip twice with expected TWAP and Balance values", async () => {
    await dripTrigger(
      deployVaultRes.vaultPeriods[0],
      deployVaultRes.vaultPeriods[1]
    );

    let [
      vaultTokenAAccountAfter,
      vaultTokenBAccountAfter,
      botTokenAAccountAfter,
      vaultAfter,
      lastVaultPeriod,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.botTokenAAcount),
      AccountUtil.fetchVaultAccount(deployVaultRes.vault),
      AccountUtil.fetchVaultPeriodAccount(deployVaultRes.vaultPeriods[1]),
    ]);

    vaultAfter.lastDripPeriod.toString().should.equal("1");
    vaultTokenAAccountAfter.balance.toString().should.equal("1500000000");
    vaultTokenBAccountAfter.balance.toString().should.equal("497753617");
    botTokenAAccountAfter.balance.toString().should.equal("500000");
    // Calculated manually by doing b/a
    lastVaultPeriod.twap.toString().should.equal("18382249418543030879");
    lastVaultPeriod.dripTimestamp.toString().should.not.equal("0");

    await sleep(1500);
    await dripTrigger(
      deployVaultRes.vaultPeriods[1],
      deployVaultRes.vaultPeriods[2]
    );

    [
      vaultTokenAAccountAfter,
      vaultTokenBAccountAfter,
      botTokenAAccountAfter,
      vaultAfter,
      lastVaultPeriod,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.botTokenAAcount),
      AccountUtil.fetchVaultAccount(deployVaultRes.vault),
      AccountUtil.fetchVaultPeriodAccount(deployVaultRes.vaultPeriods[2]),
    ]);

    vaultAfter.lastDripPeriod.toString().should.equal("2");
    vaultTokenAAccountAfter.balance.toString().should.equal("1000000000");
    vaultTokenBAccountAfter.balance.toString().should.equal("995011219");
    botTokenAAccountAfter.balance.toString().should.equal("1000000");
    lastVaultPeriod.twap.toString().should.equal("18373090397760527332");
  });

  it("should trigger drip with inverted swap", async () => {
    await dripSPLTokenSwapWrapper(
      deployVaultRes.botKeypair,
      deployVaultRes.botTokenAAcount,
      deployVaultRes.vault,
      deployVaultRes.vaultProtoConfig,
      deployVaultRes.vaultTokenAAccount,
      deployVaultRes.vaultTokenBAccount,
      swapTokenMint2,

      // Order swapped here
      swapTokenBAccount2,
      swapTokenAAccount2,

      swapFeeAccount2,
      swapAuthority2,
      swap2
    )(deployVaultRes.vaultPeriods[0], deployVaultRes.vaultPeriods[1]);
  });

  it("should trigger drip number_of_cycles number of times", async () => {
    for (let i = 0; i < 4; i++) {
      await dripTrigger(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[i + 1]
      );
      await sleep(1500);
    }

    const [
      vaultTokenAAccountAfter,
      vaultTokenBAccountAfter,
      botTokenAAccountAfter,
    ] = await Promise.all([
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenAAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.vaultTokenBAccount),
      TokenUtil.fetchTokenAccountInfo(deployVaultRes.botTokenAAcount),
    ]);
    vaultTokenAAccountAfter.balance.toString().should.equal("0");
    vaultTokenBAccountAfter.balance.toString().should.equal("1988041342");
    botTokenAAccountAfter.balance.toString().should.equal("2000000");
  });

  it("should fail to trigger drip if vault token A balance is 0", async () => {
    for (let i = 0; i < 4; i++) {
      await dripTrigger(
        deployVaultRes.vaultPeriods[i],
        deployVaultRes.vaultPeriods[i + 1]
      );
      await sleep(1500);
    }
    await dripTrigger(
      deployVaultRes.vaultPeriods[4],
      deployVaultRes.vaultPeriods[5]
    ).should.be.rejectedWith(/0x177e/); // PeriodicDripAmountIsZero
  });

  it("should fail if we trigger twice in the same granularity", async () => {
    await dripTrigger(
      deployVaultRes.vaultPeriods[0],
      deployVaultRes.vaultPeriods[1]
    );
    await dripTrigger(
      deployVaultRes.vaultPeriods[1],
      deployVaultRes.vaultPeriods[2]
    ).should.be.rejectedWith(/1773/); // DuplicateDripError
  });

  it("should fail if non-whitelisted swaps is used", async () => {
    await dripSPLTokenSwapWrapper(
      deployVaultRes.botKeypair,
      deployVaultRes.botTokenAAcount,
      deployVaultRes.vault,
      deployVaultRes.vaultProtoConfig,
      deployVaultRes.vaultTokenAAccount,
      deployVaultRes.vaultTokenBAccount,
      swapTokenMint3,
      swapTokenAAccount3,
      swapTokenBAccount3,
      swapFeeAccount3,
      swapAuthority3,
      swap3
    )(
      deployVaultRes.vaultPeriods[0],
      deployVaultRes.vaultPeriods[1]
    ).should.be.rejectedWith(/0x1778/); // InvalidSwapAccount
  });

  it("should throw an error if the vault has an oracle config defined", async () => {
    const oracleConfig = generatePair();
    await DripUtil.initOracleConfig(
      {
        oracleConfig: oracleConfig,
        tokenAMint: deployVaultRes.tokenAMint.publicKey,
        tokenAPrice: new PublicKey(ProgramUtil.pythETHPriceAccount.address),
        tokenBMint: deployVaultRes.tokenBMint.publicKey,
        tokenBPrice: new PublicKey(ProgramUtil.pythUSDCPriceAccount.address),
        creator: deployVaultRes.admin,
      },
      {
        enabled: true,
        source: 0,
        updateAuthority: deployVaultRes.admin.publicKey,
      }
    );
    await DripUtil.setVaultOracleConfig({
      admin: deployVaultRes.admin,
      vault: deployVaultRes.vault,
      vaultProtoConfig: deployVaultRes.vaultProtoConfig,
      newOracleConfig: oracleConfig.publicKey,
    });
    await dripTrigger(
      deployVaultRes.vaultPeriods[0],
      deployVaultRes.vaultPeriods[1]
    ).should.be.rejectedWith(/0x178b/);
  });
}
