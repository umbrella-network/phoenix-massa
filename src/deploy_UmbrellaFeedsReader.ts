// std
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync } from 'fs';

// massa
import { deploySC } from '@massalabs/massa-sc-deployer';
import { Args, fromMAS } from '@massalabs/massa-web3';
import { ISerializable, IDeserializedResult, ArrayType } from '@massalabs/massa-web3';

import { getClient, getContractAddressfromDeploy, waitOperationEvents } from './utils';
import {wBytes} from "./serializables/wBytes";
import {PriceData, Signature} from "./serializables/umbrella";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

const { client, account } = await getClient();

// console.log("hello");
// console.log(`env: ${process.env}`);

console.log("Deploying StakingBank contract...");

const deploy_staking_bank = await deploySC(
    process.env.JSON_RPC_URL_PUBLIC!,
    account,
    [
        {
            data: readFileSync(path.join(__dirname, 'build', 'StakingBankStaticDev.wasm')),
            coins: fromMAS(5),
            args: new Args().addU256(BigInt(2)),
        },
    ],
    0n, // fees
    4_200_000_000n, // max gas
    true, // wait for the first event to be emitted and print it into the console.
);

const bankAddr = getContractAddressfromDeploy(deploy_staking_bank);

// const bankAddr = "AS12goxZ1hvYHVYTyckESVSmiiocyfMaaK5y8XUabAeGYUAGThjsi";
console.log("StakingBankStaticDev address:", bankAddr);

console.log("Now Deploying Registry contract...");
const deploy_registry = await deploySC(
    process.env.JSON_RPC_URL_PUBLIC!,
    account,
    [
        {
            data: readFileSync(path.join(__dirname, 'build', 'Registry.wasm')),
            coins: fromMAS(10.5),
            args: new Args(),
        },
    ],
    0n, // fees
    4_200_000_000n, // max gas
    true, // wait for the first event to be emitted and print it into the console.
);

const registryAddr = getContractAddressfromDeploy(deploy_registry);
// const registryAddr = "AS12LeMT3jzY9n3PWVYKcEUoHNoeaf5kwiMytHhvAxkvthhhrowPK";
console.log("Registry address:", registryAddr);

// TODO: Nice way to init Bytes32 in ts
// Note: STAKING_BANK as Bytes32
let bank_name: Uint8Array = new Uint8Array([83, 84, 65, 75, 73, 78, 71, 95, 66, 65, 78, 75, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
let _names: Array<wBytes> = [new wBytes(bank_name)];
let _destinations: Array<string> = [bankAddr];
// console.log("_destinations", _destinations, _destinations.length);
let importAddressesArgs = new Args();
// add _names
importAddressesArgs.addSerializableObjectArray(_names);
// add _destinations
importAddressesArgs.addArray(_destinations, ArrayType.STRING);

// console.log("importAddressesArgs");
// console.log(importAddressesArgs);

const deployerAccount = client.wallet().getBaseAccount()!;

console.log(`Calling Registry.importAddresses, contract addr: ${registryAddr}`);

const operationId = await client.smartContracts().callSmartContract(
    {
        fee: 0n,
        maxGas: 70_000_000n,
        // coins: 1_000_000_000n,
        coins: 10n,
        targetAddress: registryAddr,
        functionName: 'importAddresses',
        parameter: importAddressesArgs.serialize(),
        // parameter: new Args().serialize(),
    },
    deployerAccount,
);

console.log(`operationId: ${operationId}`);

let opIds: string[] = [];
opIds.push(operationId);

let events = await Promise.all(
    opIds.map(async (opId) => waitOperationEvents(client, opId)),
);

if (events.some((e) => e.some((e) => e.context.is_error))) {
    throw new Error(`Some operations failed`);
}

console.log("Deploying UmbrellaFeeds SC...");

let requiredSignatures = 2;
const _reqSig = new ArrayBuffer(2);
const view = new DataView(_reqSig);
view.setUint16(0, requiredSignatures, true);
const reqSig = new Uint8Array(view.buffer);

// FIXME: not addU16 for class Args -> transform to UIn8Array and add manually
let umbArgs = new Args()
    .addString(registryAddr)
    .addU8(reqSig[0])
    .addU8(reqSig[1])
    .addU8(9);

console.log("umbArgs:");
console.log(umbArgs);

const deploy_umbrellaFeeds = await deploySC(
    process.env.JSON_RPC_URL_PUBLIC!,
    account,
    [
        {
            data: readFileSync(path.join(__dirname, 'build', 'UmbrellaFeeds.wasm')),
            coins: fromMAS(10),
            // args: new Args().addU256(BigInt(2)),
            args: umbArgs,
        },
    ],
    0n, // fees
    4_200_000_000n, // max gas
    true, // wait for the first event to be emitted and print it into the console.
);

const umbrellaFeedsAddr = getContractAddressfromDeploy(deploy_umbrellaFeeds);

console.log("UmbrellaFeeds address:", umbrellaFeedsAddr);
console.log(`Calling UmbrellaFeeds.update, contract addr: ${umbrellaFeedsAddr}`);

let updateArgs = new Args();
// python3: p = b'BTC-USD'; print(list(p)+[0]*(32-len(p)));
let price_1: Uint8Array = new Uint8Array([66, 84, 67, 45, 85, 83, 68, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
// python3: p = b'ETH-USD'; print(list(p)+[0]*(32-len(p)));
let price_2: Uint8Array = new Uint8Array([69, 84, 72, 45, 85, 83, 68, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
let _prices: Array<wBytes> = [new wBytes(price_1), new wBytes(price_2)];
updateArgs.addSerializableObjectArray(_prices);
let price_data_1 = new PriceData(9, 1, 2, 16535);
let price_data_2 = new PriceData(8, 1, 2, 1821);
let _price_datas: Array<PriceData> = [price_data_1, price_data_2];
updateArgs.addSerializableObjectArray(_price_datas);
let _signatures: Array<Signature> = [];
updateArgs.addSerializableObjectArray(_signatures);

console.log("updateArgs:");
console.log(updateArgs);

// const deployerAccount = client.wallet().getBaseAccount()!;
const operationId2 = await client.smartContracts().callSmartContract(
    {
        fee: 0n,
        maxGas: 700_000_000n,
        // coins: 1_000_000_000n,
        coins: 10n,
        targetAddress: umbrellaFeedsAddr,
        functionName: 'update',
        parameter: updateArgs.serialize(),
        // parameter: new Args().serialize(),
    },
    deployerAccount,
);

console.log(`operationId2: ${operationId2}`);

let opIds2: string[] = [];
opIds2.push(operationId2);

let events2 = await Promise.all(
    opIds2.map(async (opId) => waitOperationEvents(client, opId)),
);

if (events2.some((e) => e.some((e) => e.context.is_error))) {
    throw new Error(`Some operations failed`);
}

let umbReaderArgs = new Args()
    .addString(registryAddr)
    .addString(umbrellaFeedsAddr)
    .addString("ETH-USD")
    // .addU8(reqSig[0])
    // .addU8(reqSig[1])
    // .addU8(9);
    ;

console.log("umbReaderArgs:");
console.log(umbReaderArgs);

const deploy_umbrellaFeedsReader = await deploySC(
    process.env.JSON_RPC_URL_PUBLIC!,
    account,
    [
        {
            data: readFileSync(path.join(__dirname, 'build', 'UmbrellaFeedsReader.wasm')),
            coins: fromMAS(10),
            args: umbReaderArgs,
        },
    ],
    0n, // fees
    4_200_000_000n, // max gas
    true, // wait for the first event to be emitted and print it into the console.
);

const umbrellaFeedsReaderAddr = getContractAddressfromDeploy(deploy_umbrellaFeedsReader);

console.log("UmbrellaFeedsReader address:", umbrellaFeedsReaderAddr);

console.log("Calling latestRoundData...");

let latestRoundDataArgs = new Args();
const operationId3 = await client.smartContracts().callSmartContract(
    {
        fee: 0n,
        maxGas: 500_000_000n,
        // coins: 1_000_000_000n,
        coins: 100n,
        targetAddress: umbrellaFeedsReaderAddr,
        functionName: 'latestRoundData',
        parameter: latestRoundDataArgs.serialize(),
        // parameter: new Args().serialize(),
    },
    deployerAccount,
);

console.log(`operationId3: ${operationId3}`);

let opIds3: string[] = [];
opIds3.push(operationId3);

let events3 = await Promise.all(
    opIds3.map(async (opId) => waitOperationEvents(client, opId)),
);

if (events3.some((e) => e.some((e) => e.context.is_error))) {
    throw new Error(`Some operations failed`);
}
