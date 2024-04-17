import {getClient, pollEvents, okStatusOrThrow, getDynamicCosts} from "./utils";
import {importAddresses} from "./common/importAddresses";
import {Args} from "@massalabs/massa-web3";
import {getDeployedContracts} from "./common/deployed";

async function main() {
    const {client, account} = await getClient();

    console.log(`Updating Registry with StakingBank...`);
    const operationId = await importAddresses(client, "StakingBankStatic");
    let [opStatus2, events2] = await pollEvents(client, operationId, true);
    console.log("[main] events:", events2);
    okStatusOrThrow(opStatus2);
    process.exit(0);
}

main();
