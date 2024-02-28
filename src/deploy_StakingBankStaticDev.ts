import {readFileSync, writeFile} from "fs";
import path from "path";
import {fileURLToPath} from "url";

import {Args, ArrayTypes, Client, fromMAS, IReadData} from "@massalabs/massa-web3";
import {
    getClient,
    needDeploy,
    deploySc,
    pollEvents,
    okStatusOrThrow,
    getScAddressFromEvents,
} from "./utils";
import keccak256 from "@indeliblelabs/keccak256";
import {Bytes32} from "./serializables/bytes32";
import {wBytes} from "./serializables/wBytes";
import {getDeployedContracts, saveDeployedContracts} from "./common/deployed";
import {u256} from "as-bignum/assembly";

// globals
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

async function main() {
    // main entry function

    const {client, account, chainId} = await getClient();

    const jsonData = getDeployedContracts();
    const bankKey = "StakingBankStaticDev"
    const bankScAddr = jsonData[bankKey];
    const registryAddr = jsonData.Registry;

    let needDeploy_ = true;
    const toDeploy = path.join(__dirname, 'build', 'StakingBankStaticDev.wasm')
    if (bankScAddr) {
        const toDeployHash = keccak256(readFileSync(toDeploy));
        needDeploy_ = await needDeploy(client, bankScAddr, new Uint8Array(toDeployHash));
    }
    // console.log(`Need deploy: ${needDeploy_}`);

    // Initial SC coins (for gas / coins estimation)
    // TODO: Remove once https://github.com/massalabs/massa/pull/4455 is avail.
    const coins = fromMAS(0.1);

    let scAddr = bankScAddr;
    let args = new Args().addU256(BigInt(process.env.VALIDATORS_COUNT!));

    if (needDeploy_) {
        console.log("Contract has changed, need to deploy it...");
        // deploy smart contract
        let operationId = await deploySc(
            account,
            chainId,
            toDeploy,
            coins,
            args
        );
        let [opStatus, events] = await pollEvents(client, operationId, true);
        console.log("[main] events:", events);
        okStatusOrThrow(opStatus);
        scAddr = getScAddressFromEvents(events);

        // Update deployed DB with new SC address
        jsonData[bankKey] = scAddr;
        saveDeployedContracts(jsonData);
        console.log("Successfully wrote file");
        // Update Registry with newly deployed StakingBankStaticDev
        console.log(`Updating Registry (Registry.importAddresses)...`);
        const operationId2 = await updateRegistry(client, registryAddr, scAddr);
        let [opStatus2, events2] = await pollEvents(client, operationId2, true);
        okStatusOrThrow(opStatus2);

        // Registry getAddressByString check
        const scAddr2 = await registryGetAddressByString(client, registryAddr);
        console.log("scAddr2:", scAddr2);
        // Registry getAddressByString check (expect no assert and return empty Address)
        const fooAddr = await registryGetAddressByString(client, registryAddr, "FOO");
        console.log("fooAddr:", fooAddr, "--");

    } else {
        // console.log("Contract has not changed, no need to deploy it!");
    }

    console.log("[main] SC address (StakingBankStaticDev):", scAddr);

    const addresses = await getAddresses(client, scAddr);
    console.log("addresses:", addresses);
    // tmp force exit
    process.exit(0);
}

main();

async function updateRegistry(client: Client, registryAddr: string, bankAddr: string, ): Promise<string> {

    // Call Registry.importAddresses in order to store Staking bank address
    // Note that it is used when deploying UmbrellaFeeds Smart Contract

    let bank_name: Uint8Array = new Bytes32().addString("STAKING_BANK").serialize();
    let _names: Array<wBytes> = [new wBytes(bank_name)];
    let _destinations: Array<string> = [bankAddr];
    // console.log("_destinations", _destinations, _destinations.length);
    let importAddressesArgs = new Args();
    // add _names
    importAddressesArgs.addSerializableObjectArray(_names);
    // add _destinations
    importAddressesArgs.addArray(_destinations, ArrayTypes.STRING);
    // console.log("importAddressesArgs");
    // console.log(importAddressesArgs);

    const deployerAccount = client.wallet().getBaseAccount()!;

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

    return operationId
}

async function getAddresses(client: Client, scAddr: string) {

    let readData: IReadData = {
        maxGas: BigInt(10_000_000),
        targetAddress: scAddr,
        targetFunction: "getAddresses",
        parameter: new Args().serialize(),
    }
    const resp = await client.smartContracts().readSmartContract(readData);
    console.log("resp", resp);
    const addresses = new Args(resp.returnValue).nextArray(ArrayTypes.STRING);
    return addresses;
}

async function registryGetAddressByString(client: Client, registryAddr: string, query: string = "STAKING_BANK") {

    let readData: IReadData = {
        maxGas: BigInt(10_000_000),
        targetAddress: registryAddr,
        targetFunction: "getAddressByString",
        parameter: new Args().addString(query).serialize(),
    }
    const resp = await client.smartContracts().readSmartContract(readData);
    // console.log("resp", resp);
    return new Args(resp.returnValue).nextString();
}
