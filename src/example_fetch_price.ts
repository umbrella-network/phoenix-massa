import {Client, Args, IReadData} from "@massalabs/massa-web3";
import keccak256 from "@indeliblelabs/keccak256";
import {getClient} from "./utils";
import {PriceData} from "./serializables/umbrella";

let getPriceDataArgs = new Args();
let pair_ = keccak256("ARB-USD");
getPriceDataArgs.addUint8Array(new Uint8Array(pair_));
const scAddr: string = "AS1AbCFgdbCxmu5nNd13gXEZmuVqq8kKmZ1vJLbRnSw4kChNCa1d";

const {client, account} = await getClient();

let readData: IReadData = {
    maxGas: BigInt(40_000_000),
    targetAddress: scAddr,
    targetFunction: "getPriceData",
    parameter: getPriceDataArgs,
}
const resp = await client.smartContracts().readSmartContract(readData);
// const price = new Args(resp.returnValue).nextU128();
// console.log(`price: ${price}`);
const priceData = new Args(resp.returnValue).nextSerializable(PriceData);
console.log("priceData:", priceData);
