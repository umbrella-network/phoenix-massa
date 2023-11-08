import {
    Address,
    // abi
    functionExists
} from "@massalabs/massa-as-sdk";

// ~ abstract contract Registrable
export function isRegistrable(sc: Address): bool {
    assert(functionExists(sc, "register"));
    assert(functionExists(sc, "unregister"));
    assert(functionExists(sc, "getName"));

    return true;
}
