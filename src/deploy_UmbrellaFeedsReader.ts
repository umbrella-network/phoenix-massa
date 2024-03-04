import path from "path";
import {fileURLToPath} from "url";

import {Args, Client, fromMAS, IReadData, MAX_GAS_EXECUTE_SC} from "@massalabs/massa-web3";
import {getClient, deploySc, pollEvents, okStatusOrThrow, getScAddressFromEvents} from "./utils";
import {getDeployedContracts} from "./common/deployed";
import {LatestRoundData} from "./serializables/umbrella";

// globals
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

async function main() {
    // main entry function

    const {client, account, chainId} = await getClient();

    const jsonData = getDeployedContracts();
    const registryAddr = jsonData.Registry;
    const umbfAddr = jsonData.UmbrellaFeeds;

    let needDeploy_ = true;
    const toDeploy = path.join(__dirname, 'build', 'UmbrellaFeedsReader.wasm')
    console.log("toDeploy:", toDeploy);

    let key = "ETH-USD";
    let scArgs = new Args()
        .addString(registryAddr)
        .addString(umbfAddr)
        .addString(key);

    let coins = fromMAS(0.1);
    console.log("Deploying with coins:", coins);

    // deploy smart contract
    let operationId = await deploySc(
        account,
        chainId,
        toDeploy,
        coins,
        scArgs
    );
    let [opStatus, events] = await pollEvents(client, operationId, true);
    okStatusOrThrow(opStatus);
    console.log("[main] events:", events);
    let scAddr = getScAddressFromEvents(events);

    console.log("[main] SC address (UmbrellaFeedsReaderFactory):", scAddr);

    const latestRoundData1 = await getLatestRoundData(client, scAddr);
    console.log("[main] latest round data 1:", latestRoundData1);

    // tmp force exit
    process.exit(0);
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