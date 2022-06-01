import { AnchorError } from "@project-serum/anchor";

export function findError(e: AnchorError, errMsg: RegExp) {
  return e.logs.find((log) => {
    return log.match(errMsg) != null;
  });
}
