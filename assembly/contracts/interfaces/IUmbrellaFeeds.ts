import {
    Address,
    // abi
    functionExists
} from "@massalabs/massa-as-sdk";

// ~ interface IUmbrellaFeeds
export function isUmbrellaFeeds(sc: Address): bool {
    assert(functionExists(sc, "update"));
    assert(functionExists(sc, "getPriceData"));
    assert(functionExists(sc, "getSomePriceData"));
    assert(functionExists(sc, "getPriceDataByName"));
    assert(functionExists(sc, "DECIMALS"));
    return true;
}
