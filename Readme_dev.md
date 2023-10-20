## Introduction

Umbrella is a decentralized oracle service.

## Smart Contracts

### Buildnet

UmbrellaFeeds address: AS1AbCFgdbCxmu5nNd13gXEZmuVqq8kKmZ1vJLbRnSw4kChNCa1d 

Available pairs:
* UMB-USD
* ARB-USD

### Testnet

UmbrellaFeeds address: N/A

## Quickstart (Smart Contract)

Fetch BTC-USD price in a Smart Contract (AssemblyScript):

```typescript
import {u128} from 'as-bignum/assembly';
import {Args} from '@massalabs/as-types';
import {keccak256} from "@massalabs/massa-as-sdk";

let umbrellaFeedsAddress = new Address("AS1AbCFgdbCxmu5nNd13gXEZmuVqq8kKmZ1vJLbRnSw4kChNCa1d");
let priceKey = keccak256("ARB-USD");
let args = new Args().add(priceKey);
let coins = 0;
let _price = call(umbrellaFeedsAddress, "getPrice", args, coins);
let price: u128 = new Args(_price).nextU128().expect("Cannot get u128 (price)");
```

## Quickstart (massa-web3)

Fetch BTC-USD price in typescript (using massa-web3):

```typescript
import {Client, Args, IReadData} from "@massalabs/massa-web3";
import keccak256 from "@indeliblelabs/keccak256";

let getPriceDataArgs = new Args();
let pair_ = keccak256("BTC-USD");
getPriceDataArgs.addUint8Array(new Uint8Array(pair_));

let readData: IReadData = {
    maxGas: BigInt(40_000_000),
    targetAddress: scAddr,
    targetFunction: "getPrice",
    parameter: getPriceDataArgs,
}
const resp = await client.smartContracts().readSmartContract(readData);
const price = new Args(resp.returnValue).nextU128();
```

Full example is available at (src/example_fetch_price.ts):
* npm run example:fetch_price

### API 

The following functions are exported by Umbrella Smart Contract:
* getPrice
  * Argument: a hash (keccak256) of a string (e.g. BTC-USD)
  * Return: price as u128
  * Note: Assert if hash is not found
* prices:
  * Argument: a hash (keccak256) of a string (e.g. BTC-USD)
  * Return: PriceData struct
  * Note: Does not assert if hash is not found, return default PriceData
* getPriceData:
  * Argument: a hash (keccak256) of a string (e.g. BTC-USD)
  * Return: PriceData struct
  * Note: assert if hash is not found
* getPriceDataByName:
  * Argument: A serialized string (new Args.addString("BTC-USD)) 
  * Return: PriceData struct 
  * Note: use more gas (need to compute keccak256 hash)
* getManyPriceData:
  * Argument: a list of hash (keccak256) of a string (e.g. BTC-USD)
  * Return: a list of PriceData
  * Note: assert is a given hash is not found
* getManyPriceDataRaw:
  * Argument: a list of hash (keccak256) of a string (e.g. BTC-USD)
  * Return: a list of PriceData
  * Note: Does not assert, if a given hash is not found, a default PriceData is returned

Use the following code to handle PriceData structure in your massa-web3 code:

```typescript
import {
  Args,
  IDeserializedResult,
  ISerializable,
} from '@massalabs/massa-web3';

export class PriceData implements ISerializable<PriceData> {
  private data: number = 0; // u8
  private heartbeat: number = 0; // u32
  private timestamp: number = 0; // u32
  private price: bigint = BigInt(0); // u128

  constructor(data: number = 0, heartbeat: number = 0, timestamp: number = 0, price: bigint = BigInt(0)) {
    this.data = data;
    this.heartbeat = heartbeat;
    this.timestamp = timestamp;
    this.price = price;
  }

  serialize(): Uint8Array {
    let args = new Args()
        .addU8(this.data)
        .addU32(this.heartbeat)
        .addU32(this.timestamp)
        .addU128(BigInt(this.price));
    return new Uint8Array(args.serialize());
  }
  deserialize(data: Uint8Array, offset: number): IDeserializedResult<PriceData> {
    const args = new Args(data, offset);
    this.data = parseInt(args.nextU8().toString());
    this.heartbeat = args.nextU32();
    this.timestamp = args.nextU32();
    this.price = BigInt(parseInt(args.nextU128().toString()));
    return { instance: this, offset: args.getOffset() };
  }
}
```
