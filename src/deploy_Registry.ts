import {readFileSync} from "fs";
import path from "path";
import {fileURLToPath} from "url";

import {Args, fromMAS} from "@massalabs/massa-web3";
import {
    getClient,
    needDeploy,
    deploySc,
    pollEvents,
    okStatusOrThrow,
    getScAddressFromEvents,
} from "./utils";
import keccak256 from "@indeliblelabs/keccak256";
import {getDeployedContracts, saveDeployedContracts} from "./common/deployed";

// globals
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

async function main() {
    // main entry function
    const jsonData = getDeployedContracts();

    const {client, account, chainId} = await getClient();

    const registryScAddr = jsonData.Registry;

    let needDeploy_ = true;
    const toDeploy = path.join(__dirname, 'build', 'Registry.wasm')
    if (registryScAddr) {
        const toDeployHash = keccak256(readFileSync(toDeploy));
        needDeploy_ = await needDeploy(client, registryScAddr, new Uint8Array(toDeployHash));
    }
    // console.log(`Need deploy: ${needDeploy_}`);

    // Initial SC coins (for gas / coins estimation)
    // TODO: Remove once https://github.com/massalabs/massa/pull/4455 is avail.
    const coins = fromMAS(0.5);

    let scAddr = registryScAddr;
    if (needDeploy_) {
        console.log("Contract has changed, need to deploy it...");
        // deploy smart contract
        let operationId = await deploySc(
            account,
            chainId,
            toDeploy,
            coins,
            new Args()
        );
        let [opStatus, events] = await pollEvents(client, operationId, true);
        console.log("[main] events:", events);
        okStatusOrThrow(opStatus);
        scAddr = getScAddressFromEvents(events);

        // Update deployed DB with new SC address
        jsonData.Registry = scAddr;
        saveDeployedContracts(jsonData);
        console.log("Successfully wrote file");
    } else {
        // console.log("Contract has not changed, no need to deploy it!");
    }

    console.log("[main] SC address (Registry):", scAddr);
    // tmp force exit
    process.exit(0);
}

main();
