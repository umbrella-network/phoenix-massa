import {
    Args,
    Client,
    ClientFactory, DefaultProviderUrls,
    EOperationStatus,
    IAccount,
    IEvent,
    IReadData,
    WalletClient
} from "@massalabs/massa-web3";
import {deploySC} from "@massalabs/massa-sc-deployer";
import {readFileSync} from "fs";
import {config} from "dotenv-safe";

config({
    path: `.env`,
    example: `.env.example`,
});

export const getClient = async (): Promise<{
    client: Client;
    account: IAccount;
}> => {
    if (!process.env.WALLET_SECRET_KEY) {
        throw new Error('WALLET_SECRET_KEY env variable is not set');
    }
    const account = await WalletClient.getAccountFromSecretKey(
        process.env.WALLET_SECRET_KEY,
    );
    console.log('Using account: ', account.address);

    return {
        client: await ClientFactory.createDefaultClient(
            process.env.JSON_RPC_URL_PUBLIC as DefaultProviderUrls,
            false,
            account,
        ),
        account,
    };
};

export async function deploySc(account: IAccount, scPath: string, coins: bigint, args: Args): Promise<string> {
    const deploy_sc = await deploySC(
        process.env.JSON_RPC_URL_PUBLIC!,
        account,
        [
            {
                data: readFileSync(scPath),
                // Storage cost
                coins: coins,
                args: args,
            },
        ],
        0n, // fees
        4_200_000_000n, // max gas
        false, // wait for the first event to be emitted and print it into the console.
    );
    return deploy_sc.opId;
}

export async function pollEvents(client: Client, operationId: string, final: boolean = false): Promise<[EOperationStatus, IEvent[]]> {

    let result = EOperationStatus.NOT_FOUND;

    const finalSuccess = client
        .smartContracts()
        .awaitRequiredOperationStatus(operationId, EOperationStatus.FINAL);

    // const finalError = client
    //     .smartContracts()
    //     .awaitRequiredOperationStatus(operationId, EOperationStatus.FINAL_ERROR);

    const finalResult = await Promise.race([finalSuccess]);
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
    if (status != EOperationStatus.FINAL) {
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
    const resp = await client.smartContracts().readSmartContract(readData);
    // console.log("resp", resp);
    const deployedHash = new Args(resp.returnValue).nextUint8Array();
    // console.log(`deployedHash: ${deployedHash}`);
    // console.log(`toDeployedHash: ${toDeployHash}`);

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
