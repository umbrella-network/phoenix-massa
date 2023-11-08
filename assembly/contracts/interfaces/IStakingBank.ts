import {
  Address,
  // abi
  functionExists
} from "@massalabs/massa-as-sdk";


export function isStakingBank(sc: Address): bool {
    assert(functionExists(sc, "validators"), "No func validators");
    return true;
}
