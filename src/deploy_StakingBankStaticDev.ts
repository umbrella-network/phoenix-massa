// std
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync } from 'fs';

// massa
import { deploySC } from '@massalabs/massa-sc-deployer';
import { Args, fromMAS } from '@massalabs/massa-web3';

import {getClient, getContractAddressfromDeploy, waitOperationEvents} from './utils';
import {EvmAddress} from "./serializables/evmAddress";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

const { client, account } = await getClient();

// console.log("hello");
// console.log(`env: ${process.env}`);

const deploy = await deploySC(
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

const bankAddr = getContractAddressfromDeploy(deploy);

// const bankAddr = "AS123zjzP7AwGXfZ4fWu9rAAqKGg3u5Hwd2j49r2svdaLeCCEytdt";
console.log("contract address:", bankAddr);

{
    let args = new Args();
    // args.addSerializable(EvmAddress.fromHex("0000000000000000000000000000000000000001"));
    // args.addSerializable(EvmAddress.fromHex("Dc3eBc37DA53A644D67E5E3b5BA4EEF88D969d5C"));
    args.addSerializable(EvmAddress.fromHex("998cb7821e605cC16b6174e7C50E19ADb2Dd2fB0"));

    const deployerAccount = client.wallet().getBaseAccount()!;
    console.log(`Calling StakingBankStaticDev.validators...`);
    const operationId1 = await client.smartContracts().callSmartContract(
        {
            fee: 0n,
            maxGas: 10_000_000n,
            // coins: 1_000_000_000n,
            coins: 0n,
            targetAddress: bankAddr,
            functionName: 'validators',
            parameter: args.serialize(),
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
}

{
    let args = new Args();
    let _evmAddresses = new Array<EvmAddress>(2);
    _evmAddresses[0] = EvmAddress.fromHex("Dc3eBc37DA53A644D67E5E3b5BA4EEF88D969d5C");
    _evmAddresses[1] = EvmAddress.fromHex("998cb7821e605cC16b6174e7C50E19ADb2Dd2fB0");
    args.addSerializableObjectArray(_evmAddresses);

    const deployerAccount = client.wallet().getBaseAccount()!;
    console.log(`Calling StakingBankStaticDev.verifyValidators...`);
    const operationId1 = await client.smartContracts().callSmartContract(
        {
            fee: 0n,
            maxGas: 10_000_000n,
            // coins: 1_000_000_000n,
            coins: 0n,
            targetAddress: bankAddr,
            functionName: 'verifyValidators',
            parameter: args.serialize(),
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
}

{
    let args = new Args();
    let _evmAddresses = new Array<EvmAddress>(2);
    _evmAddresses[0] = EvmAddress.fromHex("Dc3eBc37DA53A644D67E5E3b5BA4EEF88D969d5C");
    _evmAddresses[1] = EvmAddress.fromHex("098cb7821e605cC16b6174e7C50E19ADb2Dd2fB0");
    args.addSerializableObjectArray(_evmAddresses);

    const deployerAccount = client.wallet().getBaseAccount()!;
    console.log(`Calling StakingBankStaticDev.verifyValidators...`);
    const operationId1 = await client.smartContracts().callSmartContract(
        {
            fee: 0n,
            maxGas: 10_000_000n,
            // coins: 1_000_000_000n,
            coins: 0n,
            targetAddress: bankAddr,
            functionName: 'verifyValidators',
            parameter: args.serialize(),
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
}
