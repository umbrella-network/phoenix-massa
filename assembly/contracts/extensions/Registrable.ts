import {
    Address,
    // abi
    functionExists
} from "@massalabs/massa-as-sdk";

// ~ abstract contract Registrable
export function isRegistrable(sc: Address): bool {
    // let _sc = sc.toString();
    assert(functionExists(sc, "register"));
    assert(functionExists(sc, "unregister"));
    assert(functionExists(sc, "getName"));
    // TODO: add more functions (from Registrable.sol)

    return true;
}
