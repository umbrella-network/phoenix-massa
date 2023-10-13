import {readFileSync, writeFile} from "fs";
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

    const {client, account} = await getClient();

    const jsonData = getDeployedContracts();
    const umbfScAddr = jsonData.UmbrellaFeeds;
    const registryAddr = jsonData.Registry;

    let needDeploy_ = true;
    const toDeploy = path.join(__dirname, 'build', 'UmbrellaFeeds.wasm')
    if (umbfScAddr) {
        const toDeployHash = keccak256(readFileSync(toDeploy));
        needDeploy_ = await needDeploy(client, umbfScAddr, new Uint8Array(toDeployHash));
    }
    // console.log(`Need deploy: ${needDeploy_}`);

    let scAddr = umbfScAddr;
    let requiredSignatures = 2;
    // const _reqSig = new ArrayBuffer(2);
    // const view = new DataView(_reqSig);
    // view.setUint16(0, requiredSignatures, true);
    // const reqSig = new Uint8Array(view.buffer);

    // FIXME: not addU16 for class Args -> transform to UIn8Array and add manually
    let umbArgs = new Args()
        .addString(registryAddr)
        // .addU8(reqSig[0])
        // .addU8(reqSig[1])
        .addU8(requiredSignatures)
        .addU8(9);

    if (needDeploy_) {
        console.log("Contract has changed, need to deploy it...");
        // deploy smart contract
        let operationId = await deploySc(
            account,
            toDeploy,
            fromMAS(0.9),
            umbArgs
        );
        let [opStatus, events] = await pollEvents(client, operationId, true);
        okStatusOrThrow(opStatus);
        console.log("[main] events:", events);
        scAddr = getScAddressFromEvents(events);

        // Update deployed DB with new SC address
        jsonData.UmbrellaFeeds = scAddr;
        saveDeployedContracts(jsonData);
        console.log("Successfully wrote file");

    } else {
        // console.log("Contract has not changed, no need to deploy it!");
    }

    console.log("[main] SC address (UmbrellaFeeds):", scAddr);
    // tmp force exit
    process.exit(0);

}

main();
