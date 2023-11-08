import {
  Address,
  // abi
  functionExists
} from "@massalabs/massa-as-sdk";

// ~ interface IRegistry
export function isRegistry(sc: Address): bool {
    assert(functionExists(sc, "importAddresses"));
    assert(functionExists(sc, "requireAndGetAddress"));
    assert(functionExists(sc, "getAddressByString"));
    return true;
}