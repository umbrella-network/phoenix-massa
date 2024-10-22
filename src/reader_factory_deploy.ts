import {
    Client,
    Args,
    ISignature,
    NativeType,
    ArrayTypes,
    IReadData,
    MAX_GAS_EXECUTE_SC,
    fromMAS
} from "@massalabs/massa-web3";

import {getClient, getDynamicCosts, getMinimalFees, okStatusOrThrow, pollEvents} from "./utils";
import {getDeployedContracts} from "./common/deployed";
import {Address} from "@massalabs/massa-as-sdk";
import {LatestRoundData} from "./serializables/umbrella";

async function main() {
    // main entry function

    const {client, account, chainId} = await getClient();

    const jsonData = getDeployedContracts();
    const umbFactory = jsonData.UmbrellaFeedsReaderFactory;

    let feedName = "ETH-USD";
    console.log(`[main] Deploying reader for feed ${feedName}...`);
    let operationId = await deployReader(client, chainId, umbFactory, feedName);

    let [opStatus, events] = await pollEvents(client, operationId, true);
    console.log("[main] events:", events);
    okStatusOrThrow(opStatus);

    // Read deployed
    let [isDeployed, deployedAddr] = await getIsDeployed(client, umbFactory, feedName);
    console.log(`[main] Reader deployed: ${isDeployed} at address: ${deployedAddr}`);

    const latestRoundData1 = await getLatestRoundData(client, deployedAddr);
    console.log("[main] latest round data:", latestRoundData1);
}

async function deployReader(client: Client, chaindId: bigint, scAddr: string, feedName: string): Promise<string> {

    // let [estimated_gas, estimated_storage_cost] = await getDynamicCosts(
    //     client, scAddr, "update", args.serialize());
    // console.log(`Estimated gas: ${estimated_gas}`);
    // console.log(`Estimated sto: ${estimated_storage_cost}`);

    let args = new Args().addString(feedName);

    const deployerAccount = client.wallet().getBaseAccount()!;
    const operationId = await client.smartContracts().callSmartContract(
        {
            fee: await getMinimalFees(client),
            // maxGas: 70_000_000n,
            // coins: 0n,
            maxGas: MAX_GAS_EXECUTE_SC,
            coins: BigInt(fromMAS(25)),
            targetAddress: scAddr,
            functionName: 'deploy',
            parameter: args.serialize(),
        },
        deployerAccount,
    );

    return operationId;

}

async function getIsDeployed(client: Client, scAddr: string, feedName: string): Promise<[bigint, string]> {

    let readData: IReadData = {
        maxGas: BigInt(10_000_000),
        targetAddress: scAddr,
        targetFunction: "deployed",
        parameter: new Args().addString(feedName).serialize(),
    }
    const resp = await client.smartContracts().readSmartContract(readData);
    // console.log("resp", resp);

    let respArgs = new Args(resp.returnValue);
    let isDeployed = respArgs.nextU8();
    let deployedAddr = "";
    if (isDeployed) {
        deployedAddr = respArgs.nextString();
    }

    return [isDeployed, deployedAddr];
}

async function getLatestRoundData(client: Client, scAddr: string): Promise<LatestRoundData> {

    let readData: IReadData = {
        maxGas: MAX_GAS_EXECUTE_SC,
        targetAddress: scAddr,
        targetFunction: "latestRoundData",
        parameter: new Args().serialize(),
    }
    const resp = await client.smartContracts().readSmartContract(readData);
    const latestRoundData = new Args(resp.returnValue).nextSerializable(LatestRoundData);
    return latestRoundData;
}

main();