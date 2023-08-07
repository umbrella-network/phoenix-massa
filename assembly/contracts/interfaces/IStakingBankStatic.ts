import {
  Address,
  // abi
  functionExists
} from "@massalabs/massa-as-sdk";


import {
    isStakingBank
} from "./IStakingBank";

export function isStakingBankStatic(sc: Address): bool {
    isStakingBank(sc);
    // FIXME
    // assert(functionExists(sc, "verifyValidators"));
    return true;
}