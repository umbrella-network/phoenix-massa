import {u128, u256} from 'as-bignum/assembly';
import { encode as b64Encode } from "as-base64/assembly";

import {
    Args,
    bytesToString,
    fromBytes,
    Result,
    Serializable,
    stringToBytes,
    toBytes,
    wrapStaticArray,
} from '@massalabs/as-types';

import {
    Address, balance,
    call,
    Context,
    getBytecode, isSignatureValid,
    keccak256,
    Storage
} from '@massalabs/massa-as-sdk';

import {env} from '@massalabs/massa-as-sdk/assembly/env'

import {AbiEncodePacked, Bytes32, PriceData, SResult} from "./UmbrellaFeedsCommon";
import {isRegistry} from "../interfaces/IRegistry";
import {isStakingBankStatic} from "../interfaces/IStakingBankStatic";
import {publicKeyToU256, selfDestruct, wBytes, refund} from "../utils";


const NAME = "UmbrellaFeeds";

const REGISTRY_KEY = stringToBytes("REGISTRY");
const REQUIRED_SIGNATURES_KEY = stringToBytes("REQUIRED_SIGNATURES");
const DECIMALS_KEY = stringToBytes("DECIMALS");
const STAKING_BANK_KEY = stringToBytes("SB");
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
    heartbeat: u32; // Note: original type was u24

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
    assert(_priceKey.length == 32);
    let priceKey = PRICE_KEY_PREFIX.concat(_priceKey);
    let _priceDataSer = Storage.get(priceKey);
    let obj = new PriceData();
    obj.deserialize(_priceDataSer).expect("Cannot getPriceData");
    return obj;
}

function StorageGetPriceDataOrDefault(_priceKey: StaticArray<u8>): PriceData {
    assert(_priceKey.length == 32);
    let priceKey = PRICE_KEY_PREFIX.concat(_priceKey);

    if (Storage.has(priceKey)) {
        let _priceDataSer = Storage.get(priceKey);
        let obj = new PriceData();
        obj.deserialize(_priceDataSer).expect("Cannot get PriceData");
        return obj;
    } else {
        return new PriceData();
    }
}

function StorageGetSomePriceData(_priceKey: StaticArray<u8>): SResult<PriceData> {
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
    constructor(init: bool = false, _contractRegistry: Address = new Address("0"), _requiredSignatures: u8 = 0, _decimals: u8 = 0) {

        if (init) {
            assert(Context.isDeployingContract());
            assert(_requiredSignatures > 0);
            isRegistry(_contractRegistry);

            Storage.set(REGISTRY_KEY, stringToBytes(_contractRegistry.toString()));
            Storage.set(REQUIRED_SIGNATURES_KEY, toBytes<u8>(_requiredSignatures));

            let staking_bank_bytes32 = new Args().add(new Bytes32().add("STAKING_BANK").serialize());
            let _staking_bank = call(_contractRegistry, "requireAndGetAddress", staking_bank_bytes32, 0);
            let staking_bank = new Address(bytesToString(_staking_bank));
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

        let priceKey = keccak256(new AbiEncodePacked().add(_name).serialize());
        let priceData = StorageGetPriceData(priceKey);
        let deployed_at = fromBytes<u64>(Storage.get(DEPLOYED_AT_KEY));
        let block_timestamp = env.time();
        assert(priceData.timestamp == 0 && deployed_at + OFFSET_TIMESTAMP > block_timestamp) // ContractNotInitialized()

        let caller = Context.caller();
        selfDestruct(caller);
    }

    /*
    /// @inheritdoc IUmbrellaFeeds
    function update(
        bytes32[] calldata _priceKeys,
        PriceData[] calldata _priceDatas,
        Signature[] calldata _signatures
    ) external
    */
    update(_priceKeys: wBytes[], _priceDatas: PriceData[], _signatures: string[], _pubKeys: string[]): void {

        assert(_priceKeys.length == _priceDatas.length, "priceKeys len != priceDatas len"); // ArraysDataDoNotMatch
        assert(_signatures.length == _pubKeys.length, "_sig len != _pubk len");

        // for refund
        const _initialBalance: u64 = balance();

        let priceDataHash = new Args()
                .add(this.getChainId())
                .add(Context.callee().toString())
                .addSerializableObjectArray(_priceKeys)
                .addSerializableObjectArray(_priceDatas)
                ;

        let digest = b64Encode(wrapStaticArray(keccak256(priceDataHash.serialize())));
        this.verifySignatures(digest, _signatures, _pubKeys);

        let i = 0;
        while (i < _priceDatas.length) {
            let _price_key = _priceKeys[i].getData();
            assert(_price_key.length == 32);
            let _price_data = _priceDatas[i];
            // Note: Solidity Mapping always returns a value so here we return a Result
            let stored_price_data = StorageGetPriceDataOrDefault(_price_key);
            // we do not allow for older prices
            // at the same time it prevents from reusing signatures
            assert(stored_price_data.timestamp < _price_data.timestamp, "OldData"); // OldData

            StorageSetPriceData(_price_key, _price_data);
            i+=1;
        }

        refund(_initialBalance);
    }

    // function getManyPriceData(bytes32[] calldata _keys) external view returns (PriceData[] memory data)
    getManyPriceData( _keys: StaticArray<u8>[]): PriceData[] {

        let data = new Array<PriceData>(_keys.length);
        for (let i = 0; i < _keys.length; i++) {
            let _key = _keys[i];
            data[i] = StorageGetPriceDataOrDefault(_key);
            assert(data[i].timestamp == 0); // FeedNotExist()
        }
        return data;
    }

    // function getManyPriceDataRaw(bytes32[] calldata _keys) external view returns (PriceData[] memory data)
    getManyPriceDataRaw(_keys: wBytes[]): PriceData[] {

        let data = new Array<PriceData>(_keys.length);
        for (let i = 0; i < _keys.length; i++) {
            let _key = _keys[i];
            data[i] = StorageGetPriceDataOrDefault(_key.getData());
        }
        return data;
    }

    // function prices(bytes32 _key) external view returns (PriceData memory data)
    prices(_key: StaticArray<u8>): PriceData {
        return StorageGetPriceDataOrDefault(_key);
    }

    // function getPriceData(bytes32 _key) external view returns (PriceData memory data)
    getPriceData(_key: StaticArray<u8>): PriceData {
        let data = StorageGetPriceDataOrDefault(_key);
        assert(data.timestamp != 0, "FeedNotExist"); // FeedNotExist
        return data;
    }

    // New function - emulate prices fetch
    getSomePriceData(_key: StaticArray<u8>): SResult<PriceData> {
        let res = StorageGetSomePriceData(_key);
        return res;
    }

    // function getPrice(bytes32 _key) external view returns (uint128 price)
    getPrice(_key: StaticArray<u8>): u128 {
        let data = StorageGetPriceDataOrDefault(_key);
        assert(data.timestamp != 0); // FeedNotExist
        return data.price;
    }

    // function getPriceTimestamp(bytes32 _key) external view returns (uint128 price, uint32 timestamp)
    getPriceTimestamp(_key: StaticArray<u8>): PriceTimestamp {
        let data = StorageGetPriceDataOrDefault(_key);
        assert(data.timestamp != 0); // FeedNotExist
        return new PriceTimestamp(data.price, data.timestamp);
    }

    //    function getPriceTimestampHeartbeat(bytes32 _key)
    //        external
    //        view
    //        returns (uint128 price, uint32 timestamp, uint24 heartbeat)
    getPriceTimestampHeartbeat(_key: StaticArray<u8>): PriceTimestampHeartbeat {
        let data = StorageGetPriceDataOrDefault(_key);
        assert(data.timestamp != 0); // FeedNotExist
        return new PriceTimestampHeartbeat(data.price, data.timestamp, data.heartbeat)
    }

    // function getPriceDataByName(string calldata _name) external view returns (PriceData memory data)
    getPriceDataByName(_name: string): PriceData {
        let args = new AbiEncodePacked().add(_name);
        let key = keccak256(args.serialize());
        return this.prices(key);
    }

    /// @dev helper method for QA purposes
    /// @return hash of data that are signed by validators (keys and priced data)
    //     function hashData(bytes32[] calldata _priceKeys, PriceData[] calldata _priceDatas)
    //         external
    //         view
    //         returns (bytes32)
    hashData(_priceKeys: wBytes[], _priceDatas: Array<PriceData>): StaticArray<u8> {

        let priceDataHash = new Args()
            .add(this.getChainId())
            .add(Context.callee().toString())
            .addSerializableObjectArray(_priceKeys)
            .addSerializableObjectArray(_priceDatas);

        let digest = keccak256(priceDataHash.serialize());
        return digest;
    }

    // function verifySignatures(bytes32 _hash, Signature[] calldata _signatures) public view {
    verifySignatures(_hash: string, _signatures: string[], _pubKeys: string[]): void {

        let _REQUIRED_SIGNATURES: i32 = fromBytes<u8>(Storage.get(REQUIRED_SIGNATURES_KEY));
        assert(_signatures.length >= _REQUIRED_SIGNATURES, "NotEnoughSignatures");

        // Check for each sig if it is valid
        let prevSigner = u256.Zero;
        for(let i=0; i<_signatures.length; i++) {
            assert(isSignatureValid(_pubKeys[i], _hash, _signatures[i]), "Sig is not valid");
            let signer = publicKeyToU256(_pubKeys[i]);
            assert(signer > prevSigner, "Sig out of order");
            prevSigner = signer;
        }

        let _stakingBankAddr = Storage.get(STAKING_BANK_KEY)
        let stakingBankAddr = new Address(bytesToString(_stakingBankAddr));
        isStakingBankStatic(stakingBankAddr);
        let verifyValidatorsArgs = new Args()
            .add(_pubKeys);

        let _ret = call(stakingBankAddr, "verifyValidators", verifyValidatorsArgs, 0);
        let ret: bool = new Args(_ret).nextBool().expect("Cannot get bool");
        assert(ret == true, "InvalidSigner"); // InvalidSigner
    }

    // function getChainId() public view returns (uint256 id)
    getChainId(): u256 {
        // Evm chainid spec:
        // https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1344.md
        // For now, return 13119191 (m=13, a=1, s=19, s=19, a=1)
        return u256.from(13119191);
    }

    // function getName() public pure returns (bytes32)
    getName(): StaticArray<u8> {
        return new Bytes32().add("UmbrellaFeeds").serialize();
    }

    // Getter / Setter
    DECIMALS(): u8 {
        let decimals: u8 = 0;
        if (Storage.has(DECIMALS_KEY)) {
            decimals = fromBytes<u8>(Storage.get(DECIMALS_KEY));
        }
        return decimals;
    }

    REQUIRED_SIGNATURES(): u8 {
        let required_signatures: u8 = 0;
        if (Storage.has(REQUIRED_SIGNATURES_KEY)) {
            required_signatures = fromBytes<u8>(Storage.get(REQUIRED_SIGNATURES_KEY));
        }
        return required_signatures;
    }
}

export function constructor(_args: StaticArray<u8>): void {
   let args = new Args(_args);
   let _contractRegistryStr = args.nextString().expect("Cannot deser Address OO");
   let _contractRegistry = new Address(_contractRegistryStr);
   // Note: no nextU16 on Args - gh #290 - https://github.com/massalabs/as/issues/290
   let _requiredSignatures: u8 = args.nextU8().expect("Cannot get _requiredSignatures");
   let _decimals: u8 = args.nextU8().expect("Cannot get _decimals");
   let _ = new UmbrellaFeeds(true, _contractRegistry, _requiredSignatures, _decimals);
   return;
}

export function update(_args: StaticArray<u8>): void {

    let args = new Args(_args);
    let _priceKeys: Array<wBytes> = args
        .nextSerializableObjectArray<wBytes>()
        .expect("Cannot get _priceKeys");
    let _priceDatas = args
        .nextSerializableObjectArray<PriceData>()
        .expect("Cannot get _priceDatas");
    let _signatures = args.nextStringArray().expect("Cannot get _sig");
    let _pubKeys = args.nextStringArray().expect("Cannot get _pubKeys");

    let umbrellaFeeds = new UmbrellaFeeds();
    umbrellaFeeds.update(_priceKeys, _priceDatas, _signatures, _pubKeys);
    return;
}

export function destroy(_args: StaticArray<u8>): void {
    let _name = new Args(_args).nextString().expect("Cannot get string (_name)");
    let umbrellaFeeds = new UmbrellaFeeds();
    umbrellaFeeds.destroy(_name);
    return;
}

export function getManyPriceDataRaw(_keys: StaticArray<u8>): StaticArray<u8> {
    let args = new Args(_keys);
    let keys = args.nextSerializableObjectArray<wBytes>().expect("Cannot get array of bytes (_keys)");
    let umbrellaFeeds = new UmbrellaFeeds();
    let _prices = umbrellaFeeds.getManyPriceDataRaw(keys);
    return new Args().addSerializableObjectArray(_prices).serialize();
}

export function getPriceData(_key: StaticArray<u8>): StaticArray<u8> {
    let args = new Args(_key);
    let key = args.nextBytes().expect("Cannot get bytes (_key)");
    let umbrellaFeeds = new UmbrellaFeeds();
    let _priceData = umbrellaFeeds.getPriceData(key);
    return new Args().add(_priceData).serialize();
}

export function getSomePriceData(_key: StaticArray<u8>): StaticArray<u8> {
    let args = new Args(_key);
    let key = args.nextBytes().expect("Cannot get _key");
    let umbrellaFeeds = new UmbrellaFeeds();
    let _priceData = umbrellaFeeds.getSomePriceData(key);
    return new Args().add(_priceData).serialize();
}

export function getPrice(_args: StaticArray<u8>): StaticArray<u8> {
    let args = new Args(_args);
    let key = args.nextBytes().expect("Cannot get _key");
    let umbrellaFeeds = new UmbrellaFeeds();
    let _price = umbrellaFeeds.getPrice(key);
    return new Args().add(_price).serialize();
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

export function REQUIRED_SIGNATURES(): StaticArray<u8> {
    let umbrellaFeeds = new UmbrellaFeeds();
    let required_signatures = umbrellaFeeds.REQUIRED_SIGNATURES();
    return new Args().add(required_signatures).serialize();
}

export function hashData(_args: StaticArray<u8>): StaticArray<u8> {
    let args = new Args(_args);
    let _priceKeys = args.nextSerializableObjectArray<wBytes>().expect("Cannot get wBytes");
    let _priceDatas = args.nextSerializableObjectArray<PriceData>().expect("Cannot get PriceData");
    let umbrellaFeeds = new UmbrellaFeeds();
    let ret = umbrellaFeeds.hashData(_priceKeys, _priceDatas);
    return new Args().add(ret).serialize();
}

export function getDeployedBytecodeHash(): StaticArray<u8> {
    let bytecode = getBytecode();
    return new Args().add(keccak256(bytecode)).serialize();
}
