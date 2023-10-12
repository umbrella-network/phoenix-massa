import {
  Address,
  // abi
  functionExists
} from "@massalabs/massa-as-sdk";


export function isStakingBank(sc: Address): bool {
    // FIXME: check more function (once implemented)
    // assert(functionExists(sc, "setMinAmountForStake"));;
    // assert(functionExists(sc, "stake"));;
    // assert(functionExists(sc, "receiveApproval"));;
    // assert(functionExists(sc, "withdraw"));
    // assert(functionExists(sc, "exit"));
    // assert(functionExists(sc, "createaddress"));
    // assert(functionExists(sc, "remove"));
    // assert(functionExists(sc, "update"));

    // assert(functionExists(sc, "getNumberOfValidators"));
    // assert(functionExists(sc, "addresses"));
    assert(functionExists(sc, "validators"), "No func validators");
    return true;
}
