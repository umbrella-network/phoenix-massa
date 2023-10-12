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
    assert(functionExists(sc, "verifyValidators"), "No func verifyValidators");
    return true;
}