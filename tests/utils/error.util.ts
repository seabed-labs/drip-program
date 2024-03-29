import { AnchorError } from "@coral-xyz/anchor";

export function findError(e: AnchorError, errMsg: RegExp) {
  if (!e.logs) {
    return false;
  }
  return e.logs.find((log) => {
    return log.match(errMsg) != null;
  });
}
