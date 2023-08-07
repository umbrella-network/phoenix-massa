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
    // let _sc = sc.toString();
    assert(functionExists(sc, "verifyValidators"));
    return true;
}