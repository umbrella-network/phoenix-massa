import {
  Address,
  // abi
  functionExists
} from "@massalabs/massa-as-sdk";

// ~ interface IRegistry
export function isRegistry(sc: Address): bool {
    // FIXME: check more function (once implemented)
    assert(functionExists(sc, "importAddresses"));
    // assert(functionExists(sc, "importContracts"));
    // assert(functionExists(sc, "atomicUpdate"));
    assert(functionExists(sc, "requireAndGetAddress"));
    // assert(functionExists(sc, "getAddress"));
    assert(functionExists(sc, "getAddressByString"));
    // assert(functionExists(sc, "stringToBytes32"));
    return true;
}