import {u128, u256} from 'as-bignum/assembly';

import {Args, bytesToString, fromBytes, Result, Serializable, stringToBytes, toBytes,} from '@massalabs/as-types';

import {
    Address,
    call,
    Context,
    evmGetAddressFromPubkey,
    evmGetPubkeyFromSignature,
    generateEvent,
    keccak256,
    Storage
} from '@massalabs/massa-as-sdk';

import {env} from '@massalabs/massa-as-sdk/assembly/env'

import {AbiEncode, AbiEncodePacked, Bytes32, bytes32ToU256, PriceData, SResult} from "./UmbrellaFeedsCommon";
import {isRegistry} from "../interfaces/IRegistry";
import {isStakingBankStatic} from "../interfaces/IStakingBankStatic";
import {EvmAddress, selfDestruct, wBytes} from "../utils";


const ETH_PREFIX = stringToBytes("\x19Ethereum Signed Message:\n32");
const NAME = "UmbrellaFeeds";

const REGISTRY_KEY = stringToBytes("REGISTRY");
const REQUIRED_SIGNATURES_KEY = stringToBytes("REQUIRED_SIGNATURES");
const DECIMALS_KEY = stringToBytes("DECIMALS");
const STAKING_BANK_KEY = stringToBytes("DECIMALS");
const DEPLOYED_AT_KEY = stringToBytes("DEPLOYED_AT");
const PRICE_KEY_PREFIX = stringToBytes("P_");
const OFFSET_TIMESTAMP = 3*24*60*60*1000 ; // == 3 days in millis

// Solidity:
// 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0
// python3:
// l1 = bytearray.fromhex("7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0");
// print(list(l1))
const _ECDSA_S_MAX: Array<u8> = [127, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 93, 87, 110, 115, 87, 164, 80, 29, 223, 233, 47, 70, 104, 27, 32, 160];

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
    update(_priceKeys: StaticArray<u8>[], _priceDatas: PriceData[], _signatures: Signature[]): void {

        assert(_priceKeys.length == _priceDatas.length, "not same len"); // ArraysDataDoNotMatch

        let _priceDataHash = new AbiEncode()
             .add(this.getChainId())
             .add(Context.callee().toString());
        for(let i = 0; i < _priceKeys.length; i++) {
            _priceDataHash.add(new Bytes32().add(_priceKeys[i]));
        }
        for(let i = 0; i < _priceDatas.length; i++) {
            _priceDataHash.add(_priceDatas[i].data);
            // heartbeat is uint24 in Solidity but AbiEncode will provide the same result (uint24 or uint32)
            // uint24 v1 = 65536; abi.encode(v1)
            // uint32 v2 = 65536; abi.encode(v2)
            _priceDataHash.add(_priceDatas[i].heartbeat);
            _priceDataHash.add(_priceDatas[i].timestamp);
            _priceDataHash.add(_priceDatas[i].price);
        }
        let priceDataHash = keccak256(_priceDataHash.serialize());
        generateEvent("priceDataHash");
        generateEvent(priceDataHash.toString());
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
        let args = new AbiEncodePacked().add(_name);
        let key = keccak256(args.serialize());
        let data = StorageGetPriceData(key);
        if (ASC_OPTIMIZE_LEVEL == 0) {
            generateEvent(`[getPriceDataByName] ${data}`);
        }
        return data;
    }

    /// @dev helper method for QA purposes
    /// @return hash of data that are signed by validators (keys and priced data)
    //     function hashData(bytes32[] calldata _priceKeys, PriceData[] calldata _priceDatas)
    //         external
    //         view
    //         returns (bytes32)
    hashData(_priceKeys: Array<StaticArray<u8>>, _priceDatas: Array<PriceData>): StaticArray<u8> {
        let args = new AbiEncode()
            .add(this.getChainId())
            .add(Context.callee().toString())
        for(let i = 0; i < _priceKeys.length; i++) {
            args.add(new Bytes32().add(_priceKeys[i]));
        }
        for(let i = 0; i < _priceDatas.length; i++) {
            args.add(_priceDatas[i].data);
            // heartbeat is uint24 in Solidity but AbiEncode will provide the same result (uint24 or uint32)
            // uint24 v1 = 65536; abi.encode(v1)
            // uint32 v2 = 65536; abi.encode(v2)
            args.add(_priceDatas[i].heartbeat);
            args.add(_priceDatas[i].timestamp);
            args.add(_priceDatas[i].price);
        }

        let h = keccak256(args.serialize());
        if (ASC_OPTIMIZE_LEVEL == 0) {
            generateEvent(`[hashData] ${h}`);
        }

        return h;
    }

    // function verifySignatures(bytes32 _hash, Signature[] calldata _signatures) public view {
    verifySignatures(_hash: StaticArray<u8>, _signatures: Signature[]): void {

        let prevSigner = new EvmAddress();

        let _REQUIRED_SIGNATURES: i32 = fromBytes<u16>(Storage.get(REQUIRED_SIGNATURES_KEY));
        assert(_signatures.length >= _REQUIRED_SIGNATURES, "NotEnoughSignatures");
        const validators: Array<EvmAddress> = new Array(_REQUIRED_SIGNATURES);

        const ECDSA_S_MAX = bytes32ToU256(StaticArray.fromArray(_ECDSA_S_MAX));

        // See OpenZepelin impl: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/ECDSA.sol
        for(let i=0; i< _REQUIRED_SIGNATURES; i++) {

            let _sig = _signatures[i];
            assert(bytes32ToU256(_sig.s) <= ECDSA_S_MAX, "ECDSAInvalidSginatureS"); // ECDSAInvalidSginatureS

            assert(_sig.v != 27 && _sig.v != 28, "ECDSAInvalidSignatureV"); // ECDSAInvalidSignatureV
            let signer = this.recoverSigner(_hash, _sig.v, _sig.r, _sig.s);
            assert(signer.toU256() > prevSigner.toU256(), "SignaturesOutOfOrder");

            prevSigner = signer;
            validators.push(signer);
        }

        generateEvent(`[verifySignatures] validators length: ${validators.length}`);

        let stakingBankAddr = new Address(bytesToString(Storage.get(STAKING_BANK_KEY)));
        isStakingBankStatic(stakingBankAddr);
        let verifyValidatorsArgs = new Args().addSerializableObjectArray(validators);
        let _ret = call(stakingBankAddr, "verifyValidators", verifyValidatorsArgs, 0);
        let ret: bool = new Args(_ret).nextBool().expect("Cannot deser bool");
        assert(ret == true, "InvalidSigner"); // InvalidSigner
    }

    // function getChainId() public view returns (uint256 id)
    getChainId(): u256 {
        // Evm chainid spec:
        // https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1344.md
        // For now, return 13119191 (m=13, a=1, s=19, s=19, a=1)
        return u256.from(13119191);
    }

    // function recoverSigner(bytes32 _hash, uint8 _v, bytes32 _r, bytes32 _s) public pure returns (address)
    recoverSigner(_hash: StaticArray<u8>, _v: u8, _r: StaticArray<u8>, _s: StaticArray<u8>): EvmAddress {

        assert(_hash.length == 32);
        assert(_r.length == 32);
        assert(_s.length == 32);

        let hash = keccak256(new AbiEncodePacked().add(ETH_PREFIX).add(_hash).serialize());
        let sigSer = new AbiEncodePacked().add(_r).add(_s).add(_v).serialize();
        assert(sigSer.length == 65, "SigSer not 65 length");
        let pubKey = evmGetPubkeyFromSignature(hash, sigSer);
        return new EvmAddress(evmGetAddressFromPubkey(pubKey));
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

export function destroy(_args: StaticArray<u8>): void {
    let _name = new Args(_args).nextString().expect("Cannot deser _name");
    let umbrellaFeeds = new UmbrellaFeeds();
    umbrellaFeeds.destroy(_name);
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

export function hashData(_args: StaticArray<u8>): StaticArray<u8> {
    let args = new Args(_args);
    let _priceKeys = args.nextSerializableObjectArray<wBytes>().expect("Cannot deser wBytes");
    let priceKeys: Array<StaticArray<u8>> = new Array(_priceKeys.length);
    for(let i=0; i<_priceKeys.length; i++) {
        priceKeys[i] = _priceKeys[i].getData();
        generateEvent(`priceKeys[${i}]: ${priceKeys[i]}`);
    }

    let _priceDatas = args.nextSerializableObjectArray<PriceData>().expect("Cannot deser PriceData");
    generateEvent(`_priceDatas[0]: ${_priceDatas[0]}`);
    let umbrellaFeeds = new UmbrellaFeeds();
    let ret = umbrellaFeeds.hashData(priceKeys, _priceDatas);
    return new Args().add(ret).serialize();
}

