import { u128, u256 } from 'as-bignum/assembly';
// import { i256 } from 'as-bignum/assembly/integer/i256';

import {
    Args,
    fromBytes,
    // toBytes,
    stringToBytes,
    bytesToString, Serializable, Result
} from '@massalabs/as-types';

import {
    Address,
    Storage,
    // abi
    call,
    // keccak256,
    generateEvent,
    Context, keccak256, functionExists,
} from '@massalabs/massa-as-sdk';

import {PriceData, Bytes32, SResult, AbiEncodePacked} from "./UmbrellaFeedsCommon";
import { isRegistry } from "../interfaces/IRegistry";
import { isUmbrellaFeeds } from "../interfaces/IUmbrellaFeeds";

const REGISTRY_KEY = stringToBytes("REGISTRY");
const UMBRELLA_FEEDS_KEY = stringToBytes("UMB");
const DESCRIPTION_KEY = stringToBytes("DESCRIPTION");
const KEY_KEY = stringToBytes("KEY");
const DECIMALS_KEY = stringToBytes("DECIMALS");


class LatestRoundData implements Serializable {
    roundId: u64; // unused, is uint80 in solidity
    answer: u256; // FIXME: i256 is not fully impl in as-bignum pkg, was int256 in solidity
    startedAt: u256;
    updatedAt: u256;
    answeredInRound: u64; // unused, was unint80 in solidity

    constructor(roundId: u64, answer: u256, startedAt: u256, updatedAt: u256, answeredInRound: u64) {
        this.roundId = roundId;
        this.answer = answer;
        this.startedAt = startedAt;
        this.updatedAt = updatedAt;
        this.answeredInRound = answeredInRound;
    }

    public serialize(): StaticArray<u8> {
        const args = new Args();
        args.add(this.roundId);
        args.add(this.answer);
        args.add(this.startedAt);
        args.add(this.updatedAt);
        args.add(this.answeredInRound);
        return args.serialize();
    }

    public deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
        const args = new Args(data, offset);
        this.roundId = args.nextU64().expect("Cannot deser roundId");
        this.answer = args.nextU256().expect("Cannot deser answer");
        this.startedAt = args.nextU256().expect("Cannot deser startedAt");
        this.updatedAt = args.nextU256().expect("Cannot deser updatedAt");
        this.answeredInRound = args.nextU64().expect("Cannot deser answeredInRound");
        return new Result(args.offset);
    }

    public toString(): string {
        return `[LatestRoundData] ${this.roundId} ${this.answer}...`;
    }
}

class UmbrellaFeedsReader {
    // constructor(IUmbrellaFeeds _umbrellaFeeds, string memory _key) {
    constructor(init: bool = false, _registry: Address = new Address(), _umbrellaFeeds: Address = new Address(), _key: string = "") {

        if (init) {
            assert(Context.isDeployingContract());
            assert(_registry != new Address()); // EmptyAddress
            isRegistry(_registry);
            isUmbrellaFeeds(_umbrellaFeeds);

            Storage.set(REGISTRY_KEY, stringToBytes(_registry.toString()));
            Storage.set(UMBRELLA_FEEDS_KEY, stringToBytes(_umbrellaFeeds.toString()));
            // Storage.set(DESCRIPTION_KEY, stringToBytes(_key));

            let decimals = call(_umbrellaFeeds, "DECIMALS", new Args(), 0);
            Storage.set(DECIMALS_KEY, decimals);

            let hash = keccak256(new AbiEncodePacked().add(_key).serialize());
            // TODO - OPTIM: if hash.len == 32, no need to use Bytes32
            assert(hash.length == 32);
            let key = new Bytes32().add(hash).serialize();
            Storage.set(KEY_KEY, key);

            // sanity check
            call(_umbrellaFeeds, "getPriceData", new Args().add(key), 0);
        }
    }

    /// @dev decimals for feed
    //    function decimals() external view returns (uint8) {
    decimals(): u8 {
        return fromBytes<u8>(Storage.get(DECIMALS_KEY));
    }

    //     function latestRoundData()
    //         external
    //         view
    //         returns (
    //             uint80 /* roundId */,
    //             int256 answer,
    //             uint256 /* startedAt */,
    //             uint256 updatedAt,
    //             uint80 /* answeredInRound */
    //         )
    latestRoundData(): LatestRoundData {
        let priceData = this._getPriceDataRaw();
        let data = new LatestRoundData(0, u256.fromU128(priceData.price), u256.Zero, u256.from(priceData.timestamp), 0);
        if (ASC_OPTIMIZE_LEVEL == 0) {
            generateEvent(`[latestRoundData] ${data.toString()}`);
        }
        return data;
    }

    /// @dev this is main endpoint for reading feed. Feed is read from UmbrellaFeeds contract using hardcoded `KEY`.
    /// In case timestamp is empty (that means there is no data), contract will execute fallback call.
    /// @notice revert on empty data
    // function getPriceData() external view returns (IUmbrellaFeeds.PriceData memory priceData)
    getPriceData(): PriceData {
        let priceData = this._getPriceDataRaw();
        if (priceData.timestamp == 0) {
            priceData = this._fallbackCall();
        }
        return priceData;
    }

    /// @dev same as `getPriceData` but does not revert when no data
    // function getPriceDataRaw() external view returns (IUmbrellaFeeds.PriceData memory) {
    getPriceDataRaw(): PriceData {
        let priceData = this._getPriceDataRaw();
        if (priceData.timestamp == 0) {
            priceData = this._fallbackCallRaw();
        }
        return priceData;
    }

    /// @dev same as `getPriceData` but does not revert when no data
    // function _getPriceDataRaw() internal view returns (IUmbrellaFeeds.PriceData memory priceData) {
    _getPriceDataRaw(): PriceData {
        let KEY = Storage.get(KEY_KEY);
        let UMBRELLA_FEEDS = this.UMBRELLA_FEEDS();
        let _priceData = call(UMBRELLA_FEEDS, "getSomePriceData", new Args().add(KEY), 0);
        let priceData = new Args(_priceData).nextSerializable<SResult<PriceData>>().expect("No SRes");
        if (priceData.isOk()) {
            return priceData.unwrap();
        } else {
            return new PriceData();
        }
    }

    /// @dev it will revert on empty data
    // function _fallbackCall() internal view returns (IUmbrellaFeeds.PriceData memory data) {
    _fallbackCall(): PriceData {

        let registryAddr = new Address(bytesToString(Storage.get(REGISTRY_KEY)));
        isRegistry(registryAddr);
        let _umbrellaFeedsAddr = call(registryAddr, "getAddressByString", new Args(stringToBytes("UmbrellaFeeds")), 0);
        let umbrellaFeedsAddr = new Address(bytesToString(_umbrellaFeedsAddr));
        // let UMBRELLA_FEEDS = Storage.get(UMBRELLA_FEEDS_KEY);
        let UMBRELLA_FEEDS = this.UMBRELLA_FEEDS();

        // if contract was NOT updated, fallback is not needed, data does not exist - revert
        assert(umbrellaFeedsAddr == UMBRELLA_FEEDS); // FeedNotExist

        let KEY = Storage.get(KEY_KEY);
        let _priceData = call(umbrellaFeedsAddr, "getPriceData", new Args(KEY), 0);
        // let priceData = changetype<PriceData>(new PriceData(0, 0, 0, u128.Zero).deserialize(_priceData));
        let priceData = new PriceData();
        priceData.deserialize(_priceData).expect("Cannot deser PriceData");
        return priceData;
    }

    /// @dev it will not revert on empty data
    // function _fallbackCallRaw() internal view returns (IUmbrellaFeeds.PriceData memory data) {
    _fallbackCallRaw(): PriceData {

        let registryAddr = new Address(bytesToString(Storage.get(REGISTRY_KEY)));
        isRegistry(registryAddr);
        let _umbrellaFeedsAddr = call(registryAddr, "getAddressByString", new Args(stringToBytes("UmbrellaFeeds")), 0);
        let umbrellaFeedsAddr = new Address(bytesToString(_umbrellaFeedsAddr));
        assert(functionExists(umbrellaFeedsAddr, "getPriceData"));
        // let _UMBRELLA_FEEDS = Storage.get(UMBRELLA_FEEDS_KEY);
        let UMBRELLA_FEEDS = this.UMBRELLA_FEEDS();

        let priceData = new PriceData();

        // if contract was updated, we do fallback
        if (umbrellaFeedsAddr == UMBRELLA_FEEDS && Storage.has(KEY_KEY)) {
            let KEY = Storage.get(KEY_KEY);
            let _priceData = call(umbrellaFeedsAddr, "getPriceData", new Args(KEY), 0);
            // priceData is left untouched by try_deserialize so we can ignore _res
            let _res = priceData.try_deserialize(_priceData);
        }

        return priceData;
    }

    // Getter / Setter
    UMBRELLA_FEEDS(): Address {
        return new Address(bytesToString(Storage.get(UMBRELLA_FEEDS_KEY)));
    }
}

export function constructor(_args: StaticArray<u8>): void {
    let args = new Args(_args);
    let _registry = args.nextString().expect("Cannot deser str _reg");
    let _umbrellaFeeds = args.nextString().expect("Cannot deser str umbf");
    let _key: string = args.nextString().expect("Cannot deser str");
    new UmbrellaFeedsReader(true, new Address(_registry), new Address(_umbrellaFeeds), _key);
}

export function decimals(): StaticArray<u8> {
    let umbReader = new UmbrellaFeedsReader();
    let res = umbReader.decimals();
    return new Args().add(res).serialize();
}

export function latestRoundData(): StaticArray<u8> {
    let umbReader = new UmbrellaFeedsReader();
    let lrd = umbReader.latestRoundData();
    return new Args().add(lrd).serialize();
}
