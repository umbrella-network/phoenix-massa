import {getClient, pollEvents, okStatusOrThrow} from "./utils";
import {importAddresses} from "./common/importAddresses";

async function main() {
    const {client, account} = await getClient();

    console.log(`Updating Registry with UmbrellaFeeds...`);
    const operationId = await importAddresses(client, 'UmbrellaFeeds');
    let [opStatus2, events2] = await pollEvents(client, operationId, true);
    console.log("[main] events:", events2);
    okStatusOrThrow(opStatus2);
}

main();
