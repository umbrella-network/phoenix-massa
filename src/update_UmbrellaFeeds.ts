import {getClient, getDynamicCosts, okStatusOrThrow, pollEvents} from "./utils";
import {readFileSync} from "fs";
import {Client, Args, ISignature, NativeType, ArrayTypes, IReadData} from "@massalabs/massa-web3";
import keccak256 from "@indeliblelabs/keccak256";
import {wBytes} from "./serializables/wBytes";
import {PriceData} from "./serializables/umbrella";
import {u256} from "as-bignum";

const deployDb: string = "deployed.json";

async function main() {
    // main entry function

    const {client, account} = await getClient();


    const jsonString = readFileSync(deployDb, "utf-8");
    const jsonData = JSON.parse(jsonString);
    const umbfKey = "UmbrellaFeeds"
    const umbfScAddr = jsonData[umbfKey];

    const updateArgs = await dummyPrices(client, umbfScAddr);
    console.log("[main] Updating prices...");
    let operationId = await updatePrices(client, umbfScAddr, updateArgs);
    let [opStatus, events] = await pollEvents(client, operationId, true);
    console.log("[main] events:", events);
    okStatusOrThrow(opStatus);

    // Test hashData
    {
        let priceKeys = new Array<wBytes>(0);
        let priceDatas = new Array<PriceData>(0);
        let args1 = new Args()
            .addSerializableObjectArray(priceKeys)
            .addSerializableObjectArray(priceDatas);
        const hashData1 = await getHashData(client, umbfScAddr, args1);
        console.log("hashData 1:", hashData1);
    }
    {
        let priceKeys = new Array<wBytes>(2);
        priceKeys[0] = new wBytes(new Uint8Array(keccak256("BTC-USD")));
        priceKeys[1] = new wBytes(new Uint8Array(keccak256("ETH-USD")));
        let priceDatas = new Array<PriceData>(2);
        priceDatas[0] = new PriceData(9, 1, 2, BigInt(16535));
        priceDatas[1] = new PriceData(8, 1, 2, BigInt( 1821));
        let args2 = new Args()
            .addSerializableObjectArray(priceKeys)
            .addSerializableObjectArray(priceDatas);
        const hashData2 = await getHashData(client, umbfScAddr, args2);
        console.log("hashData 2:", hashData2);
    }

    // Test reading prices
    console.log("[main] Fetching BTC-USD...");
    let btcPrice = await getPrice(client, umbfScAddr, "BTC-USD");
    console.log("BTC-USD price:", btcPrice);
    console.log("[main] Fetching ETH-USD...");
    let ethPrice = await getPrice(client, umbfScAddr, "ETH-USD");
    console.log("ETH-USD price:", ethPrice);

    // Test getManyPriceDataRaw
    let prices = await getManyPriceDataRaw(client, umbfScAddr, ["BTC-USD", "ETH-USD", "X42-USD"]);
    console.log("prices:", prices);
    process.exit(0);
}

main();

async function dummyPrices(client: Client, umbfAddr: string): Promise<Args> {

    // Dummy prices for pairs: BTC-USD & ETH-USD, signed by VALIDATOR_0 & VALIDATOR_1 (in env file)

    let updateArgs = new Args();
    let sigArgs = new Args(); // only for sig
    let price_1 = keccak256("BTC-USD");
    let price_2 = keccak256("ETH-USD");
    let _prices: Array<wBytes> = [new wBytes(new Uint8Array(price_1)), new wBytes(new Uint8Array(price_2))];
    updateArgs.addSerializableObjectArray(_prices);
    sigArgs.addSerializableObjectArray(_prices);
    let price_data_1 = new PriceData(9, 1, 2, BigInt(16535));
    let price_data_2 = new PriceData(8, 1, 2, BigInt( 1821));
    let _price_datas: Array<PriceData> = [price_data_1, price_data_2];
    updateArgs.addSerializableObjectArray(_price_datas);
    sigArgs.addSerializableObjectArray(_price_datas);

    // Need to add VALIDATOR_0 && VALIDATOR_1 to wallet
    const walletClient = client.wallet();
    let _ = await walletClient.addSecretKeysToWallet([process.env.VALIDATOR_0_SECRET_KEY!, process.env.VALIDATOR_1_SECRET_KEY!]);

    // Until Massa Issue #4388 is fixed, need to encode to base64

    let toHash = new Args()
        .addU256(BigInt(13119191)) // chainid
        .addString(umbfAddr)
        .addSerializableObjectArray(_prices)
        .addSerializableObjectArray(_price_datas)
        ;

    let toSig = keccak256(toHash.serialize()).toString('base64');
    // console.log("toSig:", toSig);

    const wallet = client.wallet();
    // let sig1: ISignature = await wallet.signMessage(toSig, deployerAccount.address());
    let sig1: ISignature = await wallet.signMessage(toSig, process.env.VALIDATOR_0_ADDRESS!);
    let sig2: ISignature = await wallet.signMessage(toSig, process.env.VALIDATOR_1_ADDRESS!);
    let _signatures: Array<NativeType> = [sig1.base58Encoded, sig2.base58Encoded];
    // console.log("_signatures:", _signatures);
    updateArgs.addArray(_signatures, ArrayTypes.STRING);
    let _pubKeys: Array<NativeType> = [process.env.VALIDATOR_0_PUBLIC_KEY!, process.env.VALIDATOR_1_PUBLIC_KEY!]
    // console.log("_pubKeys:", _pubKeys);
    updateArgs.addArray(_pubKeys, ArrayTypes.STRING);

    return updateArgs;
}

async function updatePrices(client: Client, scAddr: string, args: Args) {

    let [estimated_gas, estimated_storage_cost] = await getDynamicCosts(
        client, scAddr, "update", args.serialize());
    // console.log(`Estimated gas: ${estimated_gas}`);
    // console.log(`Estimated sto: ${estimated_storage_cost}`);

    const deployerAccount = client.wallet().getBaseAccount()!;
    const operationId = await client.smartContracts().callSmartContract(
        {
            fee: 0n,
            // maxGas: 70_000_000n,
            // coins: 0n,
            maxGas: estimated_gas,
            coins: BigInt(estimated_storage_cost),
            targetAddress: scAddr,
            functionName: 'update',
            parameter: args.serialize(),
        },
        deployerAccount,
    );

    return operationId;
}

async function getHashData(client: Client, scAddr: string, args: Args) {

    let readData: IReadData = {
        maxGas: BigInt(10_000_000),
        targetAddress: scAddr,
        targetFunction: "hashData",
        parameter: args.serialize(),
    }
    const resp = await client.smartContracts().readSmartContract(readData);
    const hash = new Args(resp.returnValue).nextUint8Array();
    return hash;
}

async function getPrice(client: Client, scAddr: string, pair: string): Promise<PriceData> {


    let getPriceDataArgs = new Args();
    let pair_ = keccak256(pair);
    getPriceDataArgs.addUint8Array(new Uint8Array(pair_));

    let readData: IReadData = {
        maxGas: BigInt(40_000_000),
        targetAddress: scAddr,
        targetFunction: "getPriceData",
        parameter: getPriceDataArgs.serialize(),
    }
    const resp = await client.smartContracts().readSmartContract(readData);
    const priceData = new Args(resp.returnValue).nextSerializable(PriceData);
    return priceData;
}

async function getManyPriceDataRaw(client: Client, scAddr: string, pairs: string[]): Promise<PriceData[]> {

    let args = new Args();
    let pairs_ = new Array<wBytes>(pairs.length);
    for (let i=0; i<pairs.length; i++) {
       pairs_[i] = new wBytes(keccak256(pairs[i]));
    }
    args.addSerializableObjectArray(pairs_);

    let readData: IReadData = {
        maxGas: BigInt(40_000_000),
        targetAddress: scAddr,
        targetFunction: "getManyPriceDataRaw",
        parameter: args.serialize(),
    }
    const resp = await client.smartContracts().readSmartContract(readData);
    const priceData = new Args(resp.returnValue).nextSerializableObjectArray(PriceData);
    return priceData;
}
