import { encode as b64Encode, decode } from "as-base64/assembly";

import {
  Address,
  Storage,
  createEvent,
  generateEvent,
  callerHasWriteAccess,
  Context,
  // abi
  call
} from "@massalabs/massa-as-sdk";

import {
    Args,
    stringToBytes,
    unwrapStaticArray,
    wrapStaticArray,
    // for class Name
    Serializable,
    Result
} from "@massalabs/as-types";

import {
  onlyOwner,
  setOwner,
} from '@massalabs/sc-standards/assembly/contracts/utils/ownership';

import { isRegistrable } from "./extensions/Registrable";
import { Bytes32 } from "./onChainFeeds/UmbrellaFeedsCommon";
import { wBytes } from './utils';

function LogRegistered(dst: Address, name: StaticArray<u8>): void {
    let _name_arr = new Array<string>(1);
    _name_arr.push(name.toString());
    generateEvent(createEvent(dst.toString(), _name_arr));
}

class Registry {
    constructor(init: bool = false) {
        if (init) {
            assert(callerHasWriteAccess());
            // Note: this emits an event CHANGE_OWNER_EVENT_NAME
            setOwner(new Args().add(Context.caller()).serialize());
        }
    }

    // function importAddresses(bytes32[] calldata _names, address[] calldata _destinations) external onlyOwner
    importAddresses(_names: StaticArray<u8>[], _destinations: Address[]): void {

        onlyOwner();
        assert(_names.length == _destinations.length);

        for (let i = 0; i < _names.length; i++) {
            assert(_names[i].length == 32);
            let _dst = _destinations[i];
            let _dstBytes = new Args().add<Address>(_dst).serialize()
            Storage.set(_names[i], _dstBytes);
            LogRegistered(_dst, _names[i]);
        }
    }

    // function importContracts(address[] calldata _destinations) external onlyOwner
    importContracts(_destinations: Address[]): void {
        onlyOwner();
        for (let i = 0; i < _destinations.length; i++) {
            isRegistrable(_destinations[i]);
            let name = call(_destinations[i], "getName", new Args(), 0);
            assert(name.length == 32);
            let _dst = _destinations[i];
            Storage.set(name, new Args().add<Address>(_dst).serialize());
            LogRegistered(_dst, name);
        }
    }

    // function atomicUpdate(address _newContract) external onlyOwner
    atomicUpdate(_newContract: Address): void {
        onlyOwner();
        assert(isRegistrable(_newContract));

        let name = call(_newContract, "getName", new Args(), 0);
        assert(name.length == 32);
        let oldContract = Storage.get(name);
        Storage.set(name, _newContract.serialize());

        call(oldContract, "unregister", new Args(), 0);
        LogRegistered(_newContract, name);
    }

    // function requireAndGetAddress(bytes32 name) external view returns (address)
    requireAndGetAddress(name: StaticArray<u8>): Address {
        assert(name.length == 32);
        let _foundAddress = Storage.get(name);
        let foundAddress = new Args(_foundAddress).nextSerializable<Address>().expect("Cannot get foundAddress");
        assert(foundAddress != new Address("0")); // NameNotRegistered
        return foundAddress;
    }

    // function getAddress(bytes32 _bytes) external view returns (address)
    getAddress(_bytes: StaticArray<u8>): Address {
        assert(_bytes.length == 32);
        let _foundAddress = Storage.get(_bytes);
        return new Args(_foundAddress).nextSerializable<Address>().expect("Cannot get Address");
    }

    // function getAddressByString(string memory _name) public view returns (address)
    getAddressByString(_name: string): Address {
        let _foundAddress = Storage.get(this.stringToBytes32(_name));
        return new Args(_foundAddress).nextSerializable<Address>().expect("Cannot get Address");
    }

    // function stringToBytes32(string memory _string) public pure returns (bytes32 result)
    stringToBytes32(_string: string): StaticArray<u8> {
        let result = new Bytes32().add(_string);
        return result.serialize();
    }
}

export function constructor(args: StaticArray<u8>): void {
    // call constructor
    let reg = new Registry(true);
}

export function importAddresses(_args: StaticArray<u8>): void {

    let args = new Args(_args);
    let _names: Array<wBytes> = args
        .nextSerializableObjectArray<wBytes>()
        .expect("Cannot deser _names");

    let _destinations: Array<string> = args
        .nextStringArray()
        .expect("Cannot deser _destinations");

    let names: Array<StaticArray<u8>> = new Array(_names.length);
    for(let i = 0; i < _names.length; i++) {
        names[i] = _names[i].data;
    }
    // Array<string> -> Address[]
    let destinations: Array<Address> = new Array(_destinations.length);
    for(let i = 0; i < _destinations.length; i++) {
        destinations[i] = new Address(_destinations[i]);
    }

    let reg = new Registry();
    reg.importAddresses(names, destinations);
}

export function requireAndGetAddress(_args: StaticArray<u8>): StaticArray<u8> {

    let args = new Args(_args);
    let name = args.nextBytes().expect("Cannot deser bytes");

    let reg = new Registry();
    let addr: Address = reg.requireAndGetAddress(name);

    let ret = new Args().add(addr);
    return ret.serialize();
}

export function getAddressByString(args: StaticArray<u8>): StaticArray<u8> {
    let _name: string = new Args(args).nextString().expect("Cannot desert _name");
    let reg = new Registry();
    let addr = reg.getAddressByString(_name);
    return new Args().add(addr).serialize();
}
