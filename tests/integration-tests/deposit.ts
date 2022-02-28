import { KeypairUtils } from "../utils/KeypairUtils";
import { TokenUtils } from "../utils/TokenUtils";
import { u64 } from "@solana/spl-token";

export async function deposit() {
  const [usdcMinter, btcMinter, user] = KeypairUtils.generatePairs(3);
  const usdc = await TokenUtils.createMockUSDCMint(usdcMinter.publicKey);
  const btc = await TokenUtils.createMockUSDCMint(btcMinter.publicKey);
  await TokenUtils.mintTo(usdc, usdcMinter, user.publicKey, new u64(1e9));
  await TokenUtils.mintTo(btc, btcMinter, user.publicKey, new u64(1e3));

  it.skip("sanity check", async () => {});
}
