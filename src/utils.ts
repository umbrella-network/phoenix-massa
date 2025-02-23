import {
    Args, CHAIN_ID,
    Client,
    ClientFactory, DefaultProviderUrls,
    EOperationStatus,
    IAccount,
    IEvent,
    IReadData, MAX_GAS_EXECUTE_SC,
    WalletClient
} from "@massalabs/massa-web3";
import {deploySC} from "@massalabs/massa-sc-deployer";
import {readFileSync} from "fs";
import {config} from "dotenv-safe";

config({
    path: `.env`,
    example: `.env.example`,
});

const env = (process.env.ENV ?? 'dev').toUpperCase();
const WALLET_SECRET_KEY = process.env[`${env}_WALLET_SECRET_KEY`];
const MASSA_CHAIN_ID = env == 'PROD' ? CHAIN_ID.MainNet : CHAIN_ID.BuildNet;
const JSON_RPC_URL_PUBLIC = process.env[`${env}_JSON_RPC_URL_PUBLIC`];
export const VALIDATORS_COUNT = process.env[`${env}_VALIDATORS_COUNT`];
export const REQUIRED_SIGNATURES = parseInt(process.env[`${env}_REQUIRED_SIGNATURES`] ?? '0');
const bankSuffix = `${env[0].toUpperCase()}${env.slice(1).toLowerCase()}`
export const STAKING_BANK_CONTRACT_NAME = `StakingBankStatic${bankSuffix}`;

export const getClient = async (): Promise<{
    client: Client;
    account: IAccount;
    chainId: bigint;
}> => {
    if (!WALLET_SECRET_KEY) {
        throw new Error("WALLET_SECRET_KEY env variable is not set");
    }

    if (!MASSA_CHAIN_ID) {
        throw new Error("MASSA_CHAIN_ID env variable is not set");
    }
    const account = await WalletClient.getAccountFromSecretKey(WALLET_SECRET_KEY);
    console.log('Using ENV: ', env);
    console.log('Using account: ', account.address);
    const chainId = MASSA_CHAIN_ID;
    console.log('Using chainId: ', chainId);
    console.log('JSON_RPC_URL_PUBLIC: ', JSON_RPC_URL_PUBLIC);

    return {
        client: await ClientFactory.createDefaultClient(
            JSON_RPC_URL_PUBLIC as DefaultProviderUrls,
            chainId,
            false,
            account,
        ),
        account,
        chainId,
    };
};

export async function deploySc(account: IAccount, chainId: bigint, scPath: string, coins: bigint, fees: bigint, args: Args): Promise<string> {
    const deploy_sc = await deploySC(
        JSON_RPC_URL_PUBLIC!,
        account,
        [
            {
                data: readFileSync(scPath),
                // Storage cost
                coins: coins,
                args: args,
            },
        ],
        chainId,
        fees,
        MAX_GAS_EXECUTE_SC,
        false, // wait for the first event to be emitted and print it into the console.
    );
    return deploy_sc.opId;
}

export async function pollEvents(client: Client, operationId: string, final: boolean = false): Promise<[EOperationStatus, IEvent[]]> {

    let result = EOperationStatus.NOT_FOUND;

    const finalSuccess = client
        .smartContracts()
        .awaitRequiredOperationStatus(operationId, EOperationStatus.FINAL_SUCCESS);

    const finalError = client
        .smartContracts()
        .awaitRequiredOperationStatus(operationId, EOperationStatus.FINAL_ERROR);

    const finalResult = await Promise.race([finalSuccess, finalError]);
    // console.log("[pollEvents] status returned:", EOperationStatus[finalResult]);
    result = finalResult;

    const events: IEvent[] = await client
        .smartContracts()
        .getFilteredScOutputEvents({
            emitter_address: null,
            start: null,
            end: null,
            original_caller_address: null,
            original_operation_id: operationId,
            is_final: final,
        });
    // console.log("[pollEvents] events:", events);

    return [result, events]
}

export function okStatusOrThrow(status: EOperationStatus, context: string = "") {
    if (status != EOperationStatus.FINAL_SUCCESS) {
        throw new Error(`Speculative error or final error (status: ${status.toString()}), context: ${context}`);
    }
}

export function getScAddressFromEvents(events: IEvent[]): string {
    const deployedSCEvent = events?.find((e) =>
        e.data.includes('Contract deployed at address'),
    );

    if (!deployedSCEvent) {
        throw new Error('failed to retrieve deploy address');
    }

    return deployedSCEvent.data.substring(
        'Contract deployed at address: '.length,
        deployedSCEvent.data.length,
    );
}

export async function needDeploy(client: Client, scAddr: string, toDeployHash: Uint8Array): Promise<boolean> {

    let readData: IReadData = {
        maxGas: BigInt(10_000_000),
        targetAddress: scAddr,
        targetFunction: "getDeployedBytecodeHash",
        parameter: new Args().serialize(),
    }

    let deployedHash = new Uint8Array(0);
    try {
        const resp = await client.smartContracts().readSmartContract(readData);
        // console.log("resp", resp);
        deployedHash = new Args(resp.returnValue).nextUint8Array();
        // console.log(`deployedHash: ${deployedHash}`);
        // console.log(`toDeployedHash: ${toDeployHash}`);
    } catch (e) {
        // Note: most likely the function getDeployedByteHash() is not found on wasm file
        console.log("e:", e);
    }

    return !compareFunc(toDeployHash, deployedHash);
}

const compareFunc = (a: Uint8Array, b: Uint8Array) =>
    a.length === b.length &&
    a.every((element, index) => element === b[index]);

export function strToBytes(str: string): Uint8Array {
    if (!str.length) {
        return new Uint8Array(0);
    }
    return new Uint8Array(Buffer.from(str, 'utf-8'));
}

function BigIntMin(a: bigint, b: bigint) {
    if (a <= b) {
        return a;
    } else {
        return b;
    }
}

export async function getDynamicCosts(
    client: Client,
    targetAddress: string,
    targetFunction: string,
    parameter: number[],
): Promise<[bigint, number]> {

    const MAX_GAS = MAX_GAS_EXECUTE_SC; // Max gas for an op on Massa blockchain
    const gas_margin = 1.2;
    let estimatedGas: bigint = BigInt(MAX_GAS);
    const prefix = "Estimated storage cost: ";
    let estimatedStorageCost: number = 0;
    const storage_cost_margin = 1.1;

    try {
        const readOnlyCall = await client.smartContracts().readSmartContract({
            targetAddress: targetAddress,
            targetFunction: targetFunction,
            parameter,
            maxGas: BigInt(MAX_GAS),
        });
        // console.log("readOnlyCall:", readOnlyCall);
        // console.log("events", readOnlyCall.info.output_events);
        // console.log("===");

        estimatedGas = BigIntMin(BigInt(Math.floor(readOnlyCall.info.gas_cost * gas_margin)), MAX_GAS_EXECUTE_SC);
        let filteredEvents = readOnlyCall.info.output_events.filter((e) => e.data.includes(prefix));
        // console.log("filteredEvents:", filteredEvents);
        estimatedStorageCost = Math.floor(
            parseInt( filteredEvents[0].data.slice(prefix.length) , 10) * storage_cost_margin
        );

    } catch (err) {
        console.log(
            `Failed to get dynamic gas cost for ${targetFunction} at ${targetAddress}. Using fallback value `,
            err,
        );
    }
    return [estimatedGas, estimatedStorageCost];
}

export async function getMinimalFees(client: Client): Promise<bigint> {
    const {minimal_fees} = (await client.publicApi().getNodeStatus()) as unknown as {minimal_fees: string};

    console.log({minimal_fees});

    return BigInt(Math.trunc(parseFloat(minimal_fees ?? '0') * 1e9));
}
