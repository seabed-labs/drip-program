import { u64 } from "@solana/spl-token";

export enum Denom {
  Hundred = 100,
  Thousand = 1_000,
  Million = 1_000_000,
  Billion = 1_000_000_000,
}

export function amount(base: u64 | number | string, denom: Denom): u64 {
  return new u64(new u64(base.toString()).mul(new u64(denom.toString())));
}
