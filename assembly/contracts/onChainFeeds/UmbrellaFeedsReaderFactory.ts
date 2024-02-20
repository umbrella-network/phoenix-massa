import {
    Args,
    bytesToString,
    stringToBytes,
    Result
} from '@massalabs/as-types';

import {
    Address,
    Storage,
    createEvent,
    // abi
    call,
    keccak256,
    createSC,
    generateEvent,
    // balanceOf,
    transferCoins, Context
} from '@massalabs/massa-as-sdk';

import { isRegistry } from "../interfaces/IRegistry";
import { Bytes32 } from "./UmbrellaFeedsCommon";

const REGISTRY_KEY = stringToBytes("REGISTRY");
const READERS_KEY_PREFIX = stringToBytes("R_");

// Helpers

function StorageGetSomeReader(_readerKey: StaticArray<u8>): Result<Address> {

    // Check if a can use a PersistentMap<StaticArray<u8>, Address>
    assert(_readerKey.length == 32);
    let readerKey = READERS_KEY_PREFIX.concat(_readerKey);
    if (Storage.has(readerKey)) {
        let _readerSer = Storage.get(readerKey);
        const object = new Address();
        object.deserialize(_readerSer).expect("Cannot deser Address");
        return new Result(object);
    } else {
        return new Result(new Address(), "Could not find key in Storage");
    }
}

function StorageSetReader(_readerKey: StaticArray<u8>, _readerAddr: Address): void {
    assert(_readerKey.length == 32);
    let readerKey = READERS_KEY_PREFIX.concat(_readerKey);
    Storage.set(readerKey, _readerAddr.serialize());
}

function LogNewUmbrellaFeedsReader(umbrellaFeedsReaderAddr: Address, feedName: string): void {
    generateEvent(createEvent(umbrellaFeedsReaderAddr.toString(), [feedName]));
}

// End helpers

class UmbrellaFeedsReaderFactory {

    // constructor(IRegistry _registry)
    constructor(init: bool = false, _registry: Address = new Address()) {
        if (init) {
            assert(Context.isDeployingContract());
            assert(_registry != new Address()); // EmptyAddress
            isRegistry(_registry);
            // Registry contract
            Storage.set(REGISTRY_KEY, stringToBytes(_registry.toString()));
        }
    }

    /// @dev Method to deploy new UmbrellaFeedsReader for particular key.
    /// This deployment is optional and it can be done by anyone who needs it.
    /// Reader can be used to simplify migration from Chainlink to Umbrella.
    ///
    /// Check UmbrellaFeedsReader docs for more details.
    ///
    /// We not using minimal proxy because it does not allow for immutable variables.
    /// @param _feedName string Feed name that is registered in UmbrellaFeeds
    /// @return reader UmbrellaFeedsReader contract address, in case anyone wants to use it from Layer1
    // function deploy(string memory _feedName) external returns (UmbrellaFeedsReader reader)
    deploy(_feedName: string): Address {

        let readerAddr = this.deployed(_feedName);

        let registryAddrStr = bytesToString(Storage.get(REGISTRY_KEY));
        let registryAddr = new Address(registryAddrStr);
        let _umbrellaFeedsAddr = call(registryAddr, "getAddressByString", new Args().add("UmbrellaFeeds"), 0);
        let umbrellaFeedsAddr = new Address(bytesToString(_umbrellaFeedsAddr));

        if (readerAddr.isOk()) {
            let _readerAddr: Address = readerAddr.unwrap();
            let _umbrellaFeedsAddrFromReader = call(_readerAddr, "UMBRELLA_FEEDS", new Args(), 0);
            let umbrellaFeedsAddrFromReader = new Address(bytesToString(_umbrellaFeedsAddrFromReader));

            if (umbrellaFeedsAddrFromReader == umbrellaFeedsAddr) {
                return _readerAddr;
            }
        }

        let _umbfReaderAddr = createSC(fileToByteArray("build/UmbrellaFeedsReader.wasm"));
        // FIXME: fromMAS ?
        transferCoins(_umbfReaderAddr, 9_000_000_000);

        // TODO: use Args and deser and Address or a str here...
        let umbrellaFeedsAddrStr = bytesToString(_umbrellaFeedsAddr.slice<StaticArray<u8>>(4));
        // Calling SC constructor
        let umbfReaderConstructorArgs = new Args()
            .add(registryAddrStr)
            .add(umbrellaFeedsAddrStr)
            .add(_feedName);

        let _ = call(_umbfReaderAddr, "constructor", umbfReaderConstructorArgs, 100);

        let readerKey = this._hash(_feedName);
        // let readerKey = new Bytes32().add(_feedName).serialize();
        StorageSetReader(readerKey, _umbfReaderAddr);

        LogNewUmbrellaFeedsReader(_umbfReaderAddr, _feedName);
        return _umbfReaderAddr;
    }

    // function deployed(string memory _feedName) public view returns (UmbrellaFeedsReader)
    deployed(_feedName: string): Result<Address> {
        let readerKey_ = new Bytes32().add(_feedName).serialize();
        let readerKey = this._hash(readerKey_);
        return StorageGetSomeReader(readerKey);
    }

    // function hash(string memory _feedName) public pure returns (bytes32)
    _hash(_feedName: string): StaticArray<u8> {
        // Note: Cannot rename to hash (compiler error - reserved keyword?)
        return keccak256(new Args().add<string>(_feedName).serialize());
    }

    /// @dev to follow Registrable interface
    // function getName() public pure returns (bytes32)
    getName(): StaticArray<u8> {
        return new Bytes32().add("UmbrellaFeedsReaderFactory").serialize();
    }
}

export function constructor(_args: StaticArray<u8>): void {
    let _registryAddr = new Args(_args)
        .nextString()
        .expect("Cannot deser string");
    let registryAddr: Address = new Address(_registryAddr);
    new UmbrellaFeedsReaderFactory(true, registryAddr);
}

export function getName(): StaticArray<u8> {
    let f = new UmbrellaFeedsReaderFactory();
    let _name = f.getName();
    // Test
    // generateEvent(`getName: ${bytesToString(_name)}`);
    return new Args().add(_name).serialize();
}

export function deploy(_args: StaticArray<u8>): StaticArray<u8> {
    let args = new Args(_args);
    let _feedName = args.nextString().expect("Cannot deser str");
    let f = new UmbrellaFeedsReaderFactory();
    let _name = f.deploy(_feedName);
    let ret = new Args().add(_name);
    return ret.serialize();
}

