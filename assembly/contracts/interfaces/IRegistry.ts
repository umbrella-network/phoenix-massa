import {
  Address,
  // abi
  functionExists
} from "@massalabs/massa-as-sdk";

// ~ interface IRegistry
export function isRegistry(sc: Address): bool {
    // let _sc = sc.toString();
    assert(functionExists(sc, "importAddresses"));
    assert(functionExists(sc, "importContracts"));
    assert(functionExists(sc, "atomicUpdate"));
    assert(functionExists(sc, "requireAndGetAddress"));
    assert(functionExists(sc, "getAddress"));
    assert(functionExists(sc, "getAddressByString"));
    assert(functionExists(sc, "stringToBytes32"));
    return true;
}