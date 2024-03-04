import {readFileSync} from "fs";
import path from "path";
import {fileURLToPath} from "url";

import {Args, fromMAS} from "@massalabs/massa-web3";
import {getClient, needDeploy, deploySc, pollEvents, okStatusOrThrow, getScAddressFromEvents} from "./utils";
import keccak256 from "@indeliblelabs/keccak256";
import {getDeployedContracts, saveDeployedContracts} from "./common/deployed";

// globals
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

async function main() {
    // main entry function

    const {client, account, chainId} = await getClient();

    const jsonData = getDeployedContracts();
    const umbFactory = jsonData.UmbrellaFeedsReaderFactory;
    const registryAddr = jsonData.Registry;

    let needDeploy_ = true;
    const toDeploy = path.join(__dirname, 'build', 'UmbrellaFeedsReaderFactory.wasm')
    console.log("toDeploy:", toDeploy);
    if (umbFactory) {
        const toDeployHash = keccak256(readFileSync(toDeploy));
        needDeploy_ = await needDeploy(client, umbFactory, new Uint8Array(toDeployHash));
    }

    let scAddr = umbFactory;
    let scArgs = new Args()
        .addString(registryAddr);

    if (needDeploy_) {
        console.log("Contract has changed, need to deploy it...");

        // deploy smart contract
        let operationId = await deploySc(
            account,
            chainId,
            toDeploy,
            fromMAS(0.1),
            scArgs
        );
        let [opStatus, events] = await pollEvents(client, operationId, true);
        okStatusOrThrow(opStatus);
        console.log("[main] events:", events);
        scAddr = getScAddressFromEvents(events);

        // Update deployed DB with new SC address
        jsonData.UmbrellaFeedsReaderFactory = scAddr;
        saveDeployedContracts(jsonData);
        console.log("Successfully wrote file");

    } else {
        // console.log("Contract has not changed, no need to deploy it!");
    }

    console.log("[main] SC address (UmbrellaFeedsReaderFactory):", scAddr);
    // tmp force exit
    process.exit(0);

}

main();
