import { u128, u256 } from 'as-bignum/assembly';

import {
  Args,
  toBytes,
  fromBytes,
  Result,
  Serializable,
  stringToBytes,
  bytesToString,
  // unwrapStaticArray,
  // wrapStaticArray
} from '@massalabs/as-types';

import {
    Address,
    Storage,
    Context,
    // collections,
    generateEvent,
    // abi
    call,
    keccak256,
} from '@massalabs/massa-as-sdk';

import {
    // for abi: time
    env
} from '@massalabs/massa-as-sdk/assembly/env'

import { PriceData, ArgsPacked, Bytes32, SResult } from "./UmbrellaFeedsCommon";
import { isRegistry } from "../interfaces/IRegistry";
import { isStakingBankStatic } from "../interfaces/IStakingBankStatic";
import { wBytes } from "../utils";

const ETH_PREFIX = stringToBytes("\x19Ethereum Signed Message:\n32");
const NAME = "UmbrellaFeeds";

const REGISTRY_KEY = stringToBytes("REGISTRY");
const REQUIRED_SIGNATURES_KEY = stringToBytes("REQUIRED_SIGNATURES");
const DECIMALS_KEY = stringToBytes("DECIMALS");
const STAKING_BANK_KEY = stringToBytes("DECIMALS");
const DEPLOYED_AT_KEY = stringToBytes("DEPLOYED_AT");
const PRICE_KEY_PREFIX = stringToBytes("P_");
const OFFSET_TIMESTAMP = 3*24*60*60*1000 ; // == 3 days in millis

class PriceTimestamp {
    // Note: same order as declared by: getPriceTimestamp
    //       emulate tuple
    price: u128;
    timestamp: u32;

    constructor(price: u128, timestamp: u32) {
        this.price = price;
        this.timestamp = timestamp;
    }
}

class PriceTimestampHeartbeat {
    // Note: same order as declared by: getPriceTimestampHeartbeat
    //       emulate tuple
    price: u128;
    timestamp: u32;
    heartbeat: u32; // FIXME: u24

    constructor(price: u128, timestamp: u32, heartbeat: u32) {
        this.price = price;
        this.timestamp = timestamp;
        this.heartbeat = heartbeat;
    }
}

class Signature implements Serializable {
    v: u8;
    r: StaticArray<u8>;
    s: StaticArray<u8>;

    constructor(v: u8 = 0, r: StaticArray<u8> = [], s: StaticArray<u8> = []) {
        this.v = v;
        this.r = r;
        this.s = s;
    }

    public serialize(): StaticArray<u8> {
        const args = new Args();
        args.add(this.v);
        args.add(this.r);
        args.add(this.s);
        return args.serialize();
    }

    public deserialize(data: StaticArray<u8>, offset: i32 = 0): Result<i32> {
        const args = new Args(data, offset);
        this.v = args.nextU8().expect("Can't deserialize v");
        this.r = args.nextBytes().expect("Can't deserialize r");
        this.s = args.nextBytes().expect("Can't deserialize s");
        return new Result(args.offset);
    }
}

// Helpers

function StorageGetPriceData(_priceKey: StaticArray<u8>): PriceData {

    // Cannot have a PersistentMap<StaticArray<u8>, PriceData> cf issue massa-as-sdk #285
    // Cannot have a PersistentMap<StaticArray<u8>, StaticArray<u8>> cf issue massa-as-sdk #286
    assert(_priceKey.length == 32);
    let priceKey = PRICE_KEY_PREFIX.concat(_priceKey);
    let _priceDataSer = Storage.get(priceKey);
    let obj = new PriceData();
    obj.deserialize(_priceDataSer).expect("Cannot deser PriceData");
    return obj;
}

function StorageGetSomePriceData(_priceKey: StaticArray<u8>): SResult<PriceData> {

    // Cannot have a PersistentMap<StaticArray<u8>, PriceData> cf issue massa-as-sdk #285
    // Cannot have a PersistentMap<StaticArray<u8>, StaticArray<u8>> cf issue massa-as-sdk #286
    assert(_priceKey.length == 32);
    let priceKey = PRICE_KEY_PREFIX.concat(_priceKey);

    if (Storage.has(priceKey)) {
        let _priceDataSer = Storage.get(priceKey);
        let obj = new PriceData();
        obj.deserialize(_priceDataSer).expect("Cannot deser PriceData");
        return new SResult(obj);
    } else {
        return new SResult(new PriceData(), 'Could not find key in Storage');
    }
}

function StorageSetPriceData(_priceKey: StaticArray<u8>, _priceData: PriceData): void {
    assert(_priceKey.length == 32);
    let priceKey = PRICE_KEY_PREFIX.concat(_priceKey);
    Storage.set(priceKey, _priceData.serialize());
}

// End helpers

class UmbrellaFeeds {
    // constructor(IRegistry _contractRegistry, uint16 _requiredSignatures, uint8 _decimals)
    constructor(init: bool = false, _contractRegistry: Address = new Address("0"), _requiredSignatures: u16 = 0, _decimals: u8 = 0) {

        if (init) {
            assert(Context.isDeployingContract());
            assert(_requiredSignatures > 0);
            isRegistry(_contractRegistry);

            Storage.set(REGISTRY_KEY, stringToBytes(_contractRegistry.toString()));
            Storage.set(REQUIRED_SIGNATURES_KEY, toBytes<u16>(_requiredSignatures));

            let staking_bank_bytes32 = new Args().add(new Bytes32().add("STAKING_BANK").serialize());
            let _staking_bank = call(_contractRegistry, "requireAndGetAddress", staking_bank_bytes32, 0);
            let staking_bank = new Address(new Args(_staking_bank).nextString().expect("Cannot deser str"));
            isStakingBankStatic(staking_bank);
            Storage.set(STAKING_BANK_KEY, _staking_bank);
            Storage.set(DECIMALS_KEY, toBytes<u8>(_decimals));
            // env.time -> assembly_script_get_time -> return block slot timestamp
            Storage.set(DEPLOYED_AT_KEY, toBytes<u64>(env.time()));
        }
    }

    /// @dev destroys old contract
    /// there is sanity check that prevents abuse of destroy method
    /// @param _name string feed key to verify, that contract was initialised
    destroy(_name: string): void {

        let registryAddr = new Address(bytesToString(Storage.get(REGISTRY_KEY)));
        isRegistry(registryAddr);
        let _umbrellaFeedsAddr = call(registryAddr, "getAddressByString", new Args().add(NAME), 0);
        let umbrellaFeedsAddr = new Address(bytesToString(_umbrellaFeedsAddr));
        assert(umbrellaFeedsAddr == Context.callee()); // ContractInUse()

        let priceKey = keccak256(new ArgsPacked().add(_name).serialize());
        let priceData = StorageGetPriceData(priceKey);
        let deployed_at = fromBytes<u64>(Storage.get(DEPLOYED_AT_KEY));
        let block_timestamp = env.time();
        assert(priceData.timestamp == 0 && deployed_at + OFFSET_TIMESTAMP > block_timestamp) // ContractNotInitialized()

        // TODO: selfdestruct()
    }

    /*
    /// @inheritdoc IUmbrellaFeeds
    function update(
        bytes32[] calldata _priceKeys,
        PriceData[] calldata _priceDatas,
        Signature[] calldata _signatures
    ) external
    */
    update(_priceKeys: StaticArray<u8>[], _priceDatas: PriceData[], _signatures: Signature[]): void {

        assert(_priceKeys.length == _priceDatas.length, "not same len"); // ArraysDataDoNotMatch

        // FIXME: abi.encode
        // let _priceDataHash = new Args()
        //     .add(this.getChainId())
        //     .add(Context.callee())
        //     // TODO: find a workaround until #286 is fixed
        //     // .addSerializableObjectArray(_priceKeys)
        //     // .addSerializableObjectArray(_priceDatas)
        //     ;
        // let priceDataHash = keccak256(_priceDataHash.serialize());
        // assert(priceDataHash.length == 32);
        // this.verifySignatures(priceDataHash, _signatures);

        let i = 0;
        while (i < _priceDatas.length) {
            let _price_key = _priceKeys[i];
            assert(_price_key.length == 32);
            let _price_data = _priceDatas[i];
            // Note: Solidity Mapping always returns a value so here we return a Result
            let _stored_price_data = StorageGetSomePriceData(_price_key);
            let stored_price_data = new PriceData(0, 0, 0, u128.Zero);
            if (_stored_price_data.isOk()) {
                stored_price_data = _stored_price_data.unwrap();
            }

            // we do not allow for older prices
            // at the same time it prevents from reusing signatures
            assert(stored_price_data.timestamp < _price_data.timestamp, "ts not <"); // OldData

            StorageSetPriceData(_price_key, _price_data);
            i+=1;
        }
    }

    // function getManyPriceData(bytes32[] calldata _keys) external view returns (PriceData[] memory data)
    getManyPriceData( _keys: StaticArray<u8>[]): PriceData[] {

        let data = new Array<PriceData>(_keys.length);
        for (let i = 0; i < _keys.length; i++) {
            let _key = _keys[i];
            data[i] = StorageGetPriceData(_key);
            assert(data[i].timestamp == 0); // FeedNotExist()
        }
        return data;
    }

    // function getManyPriceDataRaw(bytes32[] calldata _keys) external view returns (PriceData[] memory data)
    getManyPriceDataRaw(_keys: StaticArray<u8>[]): PriceData[] {

        let data = new Array<PriceData>(_keys.length);
        for (let i = 0; i < _keys.length; i++) {
            let _key = _keys[i];
            data[i] = StorageGetPriceData(_key);
        }
        return data;
    }

    // function prices(bytes32 _key) external view returns (PriceData memory data)
    prices(_key: StaticArray<u8>): PriceData {
        // Already checked in StorageGetPriceData
        // assert(_key.length == 32);
        return StorageGetPriceData(_key);
    }

    // function getPriceData(bytes32 _key) external view returns (PriceData memory data)
    getPriceData(_key: StaticArray<u8>): PriceData {
        // Already checked in StorageGetPriceData
        // assert(_key.length == 32, "Not 32");
        let data = StorageGetPriceData(_key);
        assert(data.timestamp != 0, "FeedNotExist"); // FeedNotExist
        if (ASC_OPTIMIZE_LEVEL == 0) {
            generateEvent(`[getSomePriceData] ${data}`);
        }
        return data;
    }

    // New function - emulate prices fetch
    getSomePriceData(_key: StaticArray<u8>): SResult<PriceData> {
        let res = StorageGetSomePriceData(_key);
        return res;
    }

    // function getPrice(bytes32 _key) external view returns (uint128 price)
    getPrice(_key: StaticArray<u8>): u128 {
        // Not needed - done by StorageGetPriceData
        // assert(_key.length, 32);
        let data = StorageGetPriceData(_key);
        assert(data.timestamp != 0); // FeedNotExist
        return data.price;
    }

    // function getPriceTimestamp(bytes32 _key) external view returns (uint128 price, uint32 timestamp)
    getPriceTimestamp(_key: StaticArray<u8>): PriceTimestamp {
        // Not needed - done by StorageGetPriceData
        // assert(_key.length == 32);
        let data = StorageGetPriceData(_key);
        assert(data.timestamp != 0); // FeedNotExist
        return new PriceTimestamp(data.price, data.timestamp);
    }

    //    function getPriceTimestampHeartbeat(bytes32 _key)
    //        external
    //        view
    //        returns (uint128 price, uint32 timestamp, uint24 heartbeat)
    getPriceTimestampHeartbeat(_key: StaticArray<u8>): PriceTimestampHeartbeat {
        // Not needed - done by get_ds_price
        // assert(_key.length == 32);
        let data = StorageGetPriceData(_key);
        assert(data.timestamp != 0); // FeedNotExist
        return new PriceTimestampHeartbeat(data.price, data.timestamp, data.heartbeat)
    }

    // function getPriceDataByName(string calldata _name) external view returns (PriceData memory data)
    getPriceDataByName(_name: string): PriceData {

        generateEvent("getPriceDataByName");
        generateEvent(_name);
        let args = new ArgsPacked().add(_name);
        let key = keccak256(args.serialize());
        let data = StorageGetPriceData(key);
        return data;
    }

    /// @dev helper method for QA purposes
    /// @return hash of data that are signed by validators (keys and priced data)
    //     function hashData(bytes32[] calldata _priceKeys, PriceData[] calldata _priceDatas)
    //         external
    //         view
    //         returns (bytes32)
    hashData(_priceKeys: Array<StaticArray<u8>>, _priceDatas: Array<PriceData>): StaticArray<u8> {
        // abi.encode
        let args = new Args()
            .add(getChaindId())
            .add(Context.callee())
            // .add(_priceKeys)
            .add(_priceDatas);
        return keccak256(args.serialize());
    }

    // function verifySignatures(bytes32 _hash, Signature[] calldata _signatures) public view {
    verifySignatures(_hash: StaticArray<u8>, _signatures: Signature[]): void {

        let _REQUIRED_SIGNATURES: i32 = fromBytes<u16>(Storage.get(REQUIRED_SIGNATURES_KEY));
        assert(_signatures.length < _REQUIRED_SIGNATURES);

        let REQUIRED_SIGNATURES = u256.from(_REQUIRED_SIGNATURES);

        // See OpenZepelin impl: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/ECDSA.sol
        // TODO: verif
    }

    // function getChainId() public view returns (uint256 id)
    getChainId(): u256 {
        // TODO: should return a chainid value (as u256) as specified here:
        // https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1344.md
        return u256.One;
    }

    // function recoverSigner(bytes32 _hash, uint8 _v, bytes32 _r, bytes32 _s) public pure returns (address)
    recoverSigner(_hash: StaticArray<u8>, _v: u8, _r: Uint8Array, _s: StaticArray<u8>): void {
        assert(_hash.length == 32);
        let args = new ArgsPacked().add(ETH_PREFIX).add(_hash);
        // TODO: ecrecover
    }

    // function getName() public pure returns (bytes32)
    getName(): StaticArray<u8> {
        return new Bytes32().add("UmbrellaFeeds").serialize();
    }

    // Getter / Setter
    DECIMALS(): u8 {
        return fromBytes<u8>(Storage.get(DECIMALS_KEY));
    }
}

export function constructor(_args: StaticArray<u8>): void {
   let args = new Args(_args);
   let _contractRegistryStr = args.nextString().expect("Cannot deser Address OO");
   let _contractRegistry = new Address(_contractRegistryStr);
   // Note: no nextU16 on Args - gh #290 - https://github.com/massalabs/as/issues/290
   let _requiredSignatures: u16 = fromBytes<u16>(args.getNextData(sizeof<u16>()));
   let _decimals: u8 = args.nextU8().expect("Cannot deser _decimals");
   let _ = new UmbrellaFeeds(true, _contractRegistry, _requiredSignatures, _decimals);
   return;
}

export function update(_args: StaticArray<u8>): void {

    let args = new Args(_args);
    let _priceKeys: Array<wBytes> = args
        .nextSerializableObjectArray<wBytes>()
        .expect("Cannot deser _priceKeys");
    let priceKeys: Array<StaticArray<u8>> = new Array(_priceKeys.length);
    for(let i = 0; i < _priceKeys.length; i++) {
        priceKeys[i] = _priceKeys[i].data;
    }

    let _priceDatas = args
        .nextSerializableObjectArray<PriceData>()
        .expect("Cannot deser _priceDatas");
    let _signatures = args
         .nextSerializableObjectArray<Signature>()
         .expect("Cannot deser _signatures");

    let umbrellaFeeds = new UmbrellaFeeds();
    umbrellaFeeds.update(priceKeys, _priceDatas, _signatures);
    return;
}

export function getPriceData(_key: StaticArray<u8>): StaticArray<u8> {
    let args = new Args(_key);
    let key = args.nextBytes().expect("Cannot deser _key");
    let umbrellaFeeds = new UmbrellaFeeds();
    let _priceData = umbrellaFeeds.getPriceData(key);
    return new Args().add(_priceData).serialize();
}

export function getSomePriceData(_key: StaticArray<u8>): StaticArray<u8> {
    let args = new Args(_key);
    let key = args.nextBytes().expect("Cannot deser _key");
    let umbrellaFeeds = new UmbrellaFeeds();
    let _priceData = umbrellaFeeds.getSomePriceData(key);
    return new Args().add(_priceData).serialize();
}

export function getPriceDataByName(_args: StaticArray<u8>): StaticArray<u8> {
    let args = new Args(_args);
    let _name = args.nextString().expect("Cannot deser _name");
    let umbrellaFeeds = new UmbrellaFeeds();
    let _priceData = umbrellaFeeds.getPriceDataByName(_name);
    return new Args().add(_priceData).serialize();
}

export function DECIMALS(): StaticArray<u8> {
    let umbrellaFeeds = new UmbrellaFeeds();
    let decimals = umbrellaFeeds.DECIMALS();
    return new Args().add(decimals).serialize();
}

