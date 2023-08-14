// std
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync } from 'fs';

// massa
import { deploySC } from '@massalabs/massa-sc-deployer';
import { Args, fromMAS } from '@massalabs/massa-web3';
import { ISerializable, IDeserializedResult, ArrayType } from '@massalabs/massa-web3';
import keccak256 from "@indeliblelabs/keccak256";

import { getClient, getContractAddressfromDeploy, waitOperationEvents } from './utils';
import { wBytes } from './serializables/wBytes';
import { PriceData } from './serializables/umbrella';
import { EvmSignature } from './serializables/evmSignature';
import {Bytes32} from "./serializables/bytes32";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

const { client, account } = await getClient();

// console.log("hello");
// console.log(`env: ${process.env}`);

console.log("Deploying StakingBankStatic contract...");
const deploy_staking_bank = await deploySC(
    process.env.JSON_RPC_URL_PUBLIC!,
    account,
    [
        {
            data: readFileSync(path.join(__dirname, 'build', 'StakingBankStaticDev.wasm')),
            coins: fromMAS(0.2),
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

const deployerAccount = client.wallet().getBaseAccount()!;

console.log("Registry address:", registryAddr);

{
    let bank_name: Uint8Array = new Bytes32().addString("STAKING_BANK").serialize();
    let _names: Array<wBytes> = [new wBytes(bank_name)];
    let _destinations: Array<string> = [bankAddr];
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
            coins: fromMAS(0.9),
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
    console.log(`Calling UmbrellaFeeds.hashData, contract addr: ${umbrellaFeedsAddr}`);
    let args = new Args();
    let price_1 = keccak256("BTC-USD");
    let price_2 = keccak256("ETH-USD");
    let _prices: Array<wBytes> = [new wBytes(new Uint8Array(price_1)), new wBytes(new Uint8Array(price_2))];
    args.addSerializableObjectArray(_prices);
    let price_data_1 = new PriceData(9, 1, 2, 16535);
    let price_data_2 = new PriceData(8, 1, 2, 1821);
    let _price_datas: Array<PriceData> = [price_data_1, price_data_2];
    args.addSerializableObjectArray(_price_datas);
    let _signatures: Array<EvmSignature> = [];
    args.addSerializableObjectArray(_signatures);

    const operationId2 = await client.smartContracts().callSmartContract(
        {
            fee: 0n,
            maxGas: 10_00_000_000n,
            // coins: 1_000_000_000n,
            coins: 9n,
            targetAddress: umbrellaFeedsAddr,
            functionName: 'hashData',
            parameter: args.serialize(),
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


/*
{
    console.log(`Calling UmbrellaFeeds.update, contract addr: ${umbrellaFeedsAddr}`);

    let updateArgs = new Args();
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

// console.log("updateArgs:");
// console.log(updateArgs);

    const operationId2 = await client.smartContracts().callSmartContract(
        {
            fee: 0n,
            maxGas: 70_000_000n,
            // coins: 1_000_000_000n,
            coins: 0n,
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
}

{
    console.log(`Calling UmbrellaFeeds.getPriceData...`);

    let getPriceDataArgs = new Args();
    getPriceDataArgs.addSerializable(new wBytes(new Uint8Array(price_1)));
// console.log("getPriceDataArgs:");
// console.log(getPriceDataArgs);

    const operationId3 = await client.smartContracts().callSmartContract(
        {
            fee: 0n,
            maxGas: 70_000_000n,
            // coins: 1_000_000_000n,
            coins: 0n,
            targetAddress: umbrellaFeedsAddr,
            functionName: 'getPriceData',
            parameter: getPriceDataArgs.serialize(),
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
}

{
    console.log(`Calling UmbrellaFeeds.getPriceDataByName...`);

    let getPriceDataByNameArgs = new Args();
    getPriceDataByNameArgs.addString("ETH-USD");
    const operationId3_2 = await client.smartContracts().callSmartContract(
        {
            fee: 0n,
            maxGas: 70_000_000n,
            // coins: 1_000_000_000n,
            coins: 0n,
            targetAddress: umbrellaFeedsAddr,
            functionName: 'getPriceDataByName',
            parameter: getPriceDataByNameArgs.serialize(),
        },
        deployerAccount,
    );

    console.log(`operationId3_2: ${operationId3_2}`);

    let opIds3_2: string[] = [];
    opIds3_2.push(operationId3_2);

    let events3_2 = await Promise.all(
        opIds3_2.map(async (opId) => waitOperationEvents(client, opId)),
    );

    if (events3_2.some((e) => e.some((e) => e.context.is_error))) {
        throw new Error(`Some operations failed`);
    }
}
*/