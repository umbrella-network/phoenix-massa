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
import {PriceData} from "./serializables/umbrella";
import {Bytes32} from "./serializables/bytes32";
import keccak256 from "@indeliblelabs/keccak256";
import {EvmSignature} from "./serializables/evmSignature";

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
            coins: fromMAS(0.1),
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
            coins: fromMAS(0.2),
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

const deployerAccount = client.wallet().getBaseAccount()!;
let bank_name: Uint8Array = new Bytes32().addString("STAKING_BANK").serialize();

{
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
    console.log(`Calling Registry.importAddresses, contract addr: ${registryAddr}`);

    const operationId = await client.smartContracts().callSmartContract(
        {
            fee: 0n,
            maxGas: 70_000_000n,
            // coins: 1_000_000_000n,
            coins: 0n,
            targetAddress: registryAddr,
            functionName: 'importAddresses',
            parameter: importAddressesArgs.serialize(),
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

console.log("Now Deploying UmbrellaFeeds contract...");

const deploy_umbrellaFeeds = await deploySC(
    process.env.JSON_RPC_URL_PUBLIC!,
    account,
    [
        {
            data: readFileSync(path.join(__dirname, 'build', 'UmbrellaFeeds.wasm')),
            coins: fromMAS(0.2),
            args: umbArgs,
        },
    ],
    0n, // fees
    4_200_000_000n, // max gas
    true, // wait for the first event to be emitted and print it into the console.
);

const umbrellaFeedsAddr = getContractAddressfromDeploy(deploy_umbrellaFeeds);

console.log("UmbrellaFeeds address:", umbrellaFeedsAddr);

{
    // Note: UmbrellaFeeds as Bytes32
    let umb_name: Uint8Array = new Bytes32().addString("UmbrellaFeeds").serialize();
    let _names2: Array<wBytes> = [new wBytes(bank_name), new wBytes(umb_name)];
    let _destinations2: Array<string> = [bankAddr, umbrellaFeedsAddr];
    // console.log("_destinations", _destinations, _destinations.length);
    let importAddressesArgs2 = new Args();
    // add _names
    importAddressesArgs2.addSerializableObjectArray(_names2);
    // add _destinations
    importAddressesArgs2.addArray(_destinations2, ArrayType.STRING);

    // console.log("importAddressesArgs");
    // console.log(importAddressesArgs);

    console.log(`Calling Registry.importAddresses (2nd time), contract addr: ${registryAddr}`);

    const operationId0 = await client.smartContracts().callSmartContract(
        {
            fee: 0n,
            maxGas: 9_000_000n,
            // coins: 1_000_000_000n,
            coins: 0n,
            targetAddress: registryAddr,
            functionName: 'importAddresses',
            parameter: importAddressesArgs2.serialize(),
            // parameter: new Args().serialize(),
        },
        deployerAccount,
    );

    console.log(`operationId0: ${operationId0}`);

    let opIds0: string[] = [];
    opIds0.push(operationId0);

    let events0 = await Promise.all(
        opIds0.map(async (opId) => waitOperationEvents(client, opId)),
    );

    if (events0.some((e) => e.some((e) => e.context.is_error))) {
        throw new Error(`Some operations failed`);
    }
}

{
    console.log(`Calling UmbrellaFeeds.update, contract addr: ${umbrellaFeedsAddr}`);

    let updateArgs = new Args();
    // python3: p = b'BTC-USD'; print(list(p)+[0]*(32-len(p)));
    // let price_1: Uint8Array = new Uint8Array([66, 84, 67, 45, 85, 83, 68, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    // python3: p = b'ETH-USD'; print(list(p)+[0]*(32-len(p)));
    // let price_2: Uint8Array = new Uint8Array([69, 84, 72, 45, 85, 83, 68, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    let price_1 = keccak256("BTC-USD");
    let price_2 = keccak256("ETH-USD");
    let _prices: Array<wBytes> = [new wBytes(new Uint8Array(price_1)), new wBytes(new Uint8Array(price_2))];
    updateArgs.addSerializableObjectArray(_prices);
    let price_data_1 = new PriceData(9, 1, 2, 16535);
    let price_data_2 = new PriceData(8, 1, 2, 1821);
    let _price_datas: Array<PriceData> = [price_data_1, price_data_2];
    updateArgs.addSerializableObjectArray(_price_datas);
    let _signatures: Array<EvmSignature> = [];
    updateArgs.addSerializableObjectArray(_signatures);

    console.log("updateArgs:");
    console.log(updateArgs);

        // const deployerAccount = client.wallet().getBaseAccount()!;
    const operationId2 = await client.smartContracts().callSmartContract(
        {
            fee: 0n,
            maxGas: 900_000_000n,
            // coins: 1_000_000_000n,
            coins: 0n,
            targetAddress: umbrellaFeedsAddr,
            functionName: 'update',
            parameter: updateArgs.serialize(),
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
}

let umbReaderFactoryArgs = new Args().addString(registryAddr);
console.log("umbReaderFactoryArgs:");
console.log(umbReaderFactoryArgs);

console.log("Now Deploying UmbrellaFeedsFactory contract...");

const deploy_umbrellaFeedsReaderFactory = await deploySC(
    process.env.JSON_RPC_URL_PUBLIC!,
    account,
    [
        {
            data: readFileSync(path.join(__dirname, 'build', 'UmbrellaFeedsReaderFactory.wasm')),
            coins: fromMAS(100.0),
            args: umbReaderFactoryArgs,
        },
    ],
    0n, // fees
    4_200_000_000n, // max gas
    true, // wait for the first event to be emitted and print it into the console.
);

const umbrellaFeedsReaderFactoryAddr = getContractAddressfromDeploy(deploy_umbrellaFeedsReaderFactory);

console.log("UmbrellaFeedsReaderFactory address:", umbrellaFeedsReaderFactoryAddr);

{
    console.log("Calling deploy...");

    let deployArgs = new Args();
    deployArgs.addString("ETH-USD");

    const operationId3 = await client.smartContracts().callSmartContract(
        {
            fee: 0n,
            maxGas: 900_000_000n,
            coins: 0n,
            targetAddress: umbrellaFeedsReaderFactoryAddr,
            functionName: 'deploy',
            parameter: deployArgs.serialize(),
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

    let _event = events3[0][0];
    console.log("ievent");
    console.log(_event);
}

