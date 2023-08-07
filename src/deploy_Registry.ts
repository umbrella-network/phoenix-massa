// std
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync } from 'fs';

// massa
import { deploySC } from '@massalabs/massa-sc-deployer';
import { Args, fromMAS } from '@massalabs/massa-web3';
import { ISerializable, IDeserializedResult, ArrayType } from '@massalabs/massa-web3';

import { getClient, getContractAddressfromDeploy, waitOperationEvents } from './utils';
import {Bytes32} from "./serializables/bytes32";
import {wBytes} from "./serializables/wBytes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

const { client, account } = await getClient();

console.log("Now Deploying Registry contract...");
const deploy_registry = await deploySC(
    process.env.JSON_RPC_URL_PUBLIC!,
    account,
    [
        {
            data: readFileSync(path.join(__dirname, 'build', 'Registry.wasm')),
            coins: fromMAS(0.2),
            args: new Args(),
        },
    ],
    0n, // fees
    4_200_000_000n, // max gas
    true, // wait for the first event to be emitted and print it into the console.
);

const registryAddr = getContractAddressfromDeploy(deploy_registry);
console.log("Registry address:", registryAddr);

/*
// TODO: import from web3-utils
export function strToBytes(str: string): Uint8Array {
  if (!str.length) {
    return new Uint8Array(0);
  }
  return new Uint8Array(Buffer.from(str, 'utf-8'));
}
*/

/*
// TODO: move this to another file
class Name implements ISerializable<Name> {
    private arr: Uint8Array = new Uint8Array(0);

    constructor(arr: Uint8Array) {
        this.arr = arr;
    }

    serialize(): Uint8Array {
        let args = new Args().addUint8Array(this.arr);
        return new Uint8Array(args.serialize());
    }
    deserialize(data: Uint8Array, offset: number): IDeserializedResult<Name> {
        const args = new Args(data, offset);
        this.arr = args.nextUint8Array();
        return { instance: this, offset: args.getOffset() };
    }
}
*/

// Dummy data
const bankAddr = "AS12fS1S1PBMipfevxisr6chL1BGQYb5ijf6EhtTStB9sSjTqF8ds";

// STAKING_BANK as Bytes32
// let bank_name: Uint8Array = new Uint8Array([83, 84, 65, 75, 73, 78, 71, 95, 66, 65, 78, 75, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
let bank_name: Uint8Array = new Bytes32().addString("STAKING_BANK").serialize();
let _names: Array<wBytes> = [new wBytes(bank_name)];
let _destinations: Array<string> = [bankAddr];
let importAddressesArgs = new Args();
// add _names
importAddressesArgs.addSerializableObjectArray(_names);
// add _destinations
importAddressesArgs.addArray(_destinations, ArrayType.STRING);

const deployerAccount = client.wallet().getBaseAccount()!;
console.log(`Calling Registry.importAddresses, contract addr: ${registryAddr}`);
const operationId1 = await client.smartContracts().callSmartContract(
    {
        fee: 0n,
        maxGas: 10_000_000n,
        // coins: 1_000_000_000n,
        coins: 1n,
        targetAddress: registryAddr,
        functionName: 'importAddresses',
        parameter: importAddressesArgs.serialize(),
        // parameter: new Args().serialize(),
    },
    deployerAccount,
);

console.log(`operationId 1: ${operationId1}`);
let opIds1: string[] = [];
opIds1.push(operationId1);

let events1 = await Promise.all(
    opIds1.map(async (opId) => waitOperationEvents(client, opId)),
);

if (events1.some((e) => e.some((e) => e.context.is_error))) {
    throw new Error(`Some operations failed`);
}

console.log(`Calling Registry.requireAndGetAddress, contract addr: ${registryAddr}`);
const operationId2 = await client.smartContracts().callSmartContract(
    {
        fee: 0n,
        maxGas: 10_000_000n,
        // coins: 1_000_000_000n,
        coins: 1n,
        targetAddress: registryAddr,
        functionName: 'requireAndGetAddress',
        parameter: new Args().addSerializable(new wBytes(bank_name)).serialize(),
        // parameter: new Args().serialize(),
    },
    deployerAccount,
);

console.log(`operationId 2: ${operationId2}`);
let opIds2: string[] = [];
opIds2.push(operationId2);

let events2 = await Promise.all(
    opIds2.map(async (opId) => waitOperationEvents(client, opId)),
);

if (events2.some((e) => e.some((e) => e.context.is_error))) {
    throw new Error(`Some operations failed`);
}
