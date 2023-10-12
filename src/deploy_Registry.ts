import {readFileSync, writeFile} from "fs";
import path from "path";
import {fileURLToPath} from "url";

import {Args, fromMAS} from "@massalabs/massa-web3";
import {getClient, needDeploy, deploySc, pollEvents, okStatusOrThrow, getScAddressFromEvents} from "./utils";
import keccak256 from "@indeliblelabs/keccak256";

// globals
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));
const deployDb: string = "deployed.json";

async function main() {
    // main entry function

    const {client, account} = await getClient();

    const jsonString = readFileSync(deployDb, "utf-8");
    const jsonData = JSON.parse(jsonString);
    const registryScAddr = jsonData["Registry"];

    let needDeploy_ = true;
    const toDeploy = path.join(__dirname, 'build', 'Registry.wasm')
    if (registryScAddr.length > 0) {
        const toDeployHash = keccak256(readFileSync(toDeploy));
        needDeploy_ = await needDeploy(client, registryScAddr, new Uint8Array(toDeployHash));
    }
    // console.log(`Need deploy: ${needDeploy_}`);

    let scAddr = registryScAddr;
    if (needDeploy_) {
        console.log("Contract has changed, need to deploy it...");
        // deploy smart contract
        let operationId = await deploySc(
            account,
            toDeploy,
            fromMAS(0.2),
            new Args()
        );
        let [opStatus, events] = await pollEvents(client, operationId, true);
        okStatusOrThrow(opStatus);
        console.log("[main] events:", events);
        scAddr = getScAddressFromEvents(events);

        // Update deployed DB with new SC address
        jsonData["Registry"] = scAddr;
        writeFile(deployDb, JSON.stringify(jsonData, null, 2), (err) => {
            if (err) {
                console.log("Error writing file:", err);
            } else {
                console.log("Successfully wrote file");
            }
        });
    } else {
        // console.log("Contract has not changed, no need to deploy it!");
    }

    console.log("[main] SC address (Registry):", scAddr);
}

main();
