import { u128, u256 } from 'as-bignum/assembly';

import {
    Address,
    Storage,
    Context
} from "@massalabs/massa-as-sdk";

import {
    Args,
    Serializable,
    stringToBytes,
    unwrapStaticArray
} from "@massalabs/as-types";


export class Validator implements Serializable {
    id: Address;
    location: string;

    constructor(id: Address, location: String) {
        this.id = id;
        this.location = location;
    }

    public serialize(): StaticArray<u8> {
        const args = new Args();
        args.add(this.id);
        args.add(this.location);
        return args.serialize();
    }

    public deserialize(data: StaticArray<u8>, offset: i32 = 0): Result<i32> {
        const args = new Args(data, offset);
        this.id = args.nextString().expect("Can't deserialize id");
        this.location = args.nextAddress().expect("Can't deserialize location");
        return new Result(args.offset);
    }
}

export abstract class StakingBankStatic {

    NUMBER_OF_VALIDATORS_KEY: StaticArray<u8> = stringToBytes("NV");
    TOTAL_SUPPLY_KEY: StaticArray<u8> = stringToBytes("TS");
    ONE: u256 = u256.fromF64(1e18);

    constructor(_validatorsCount: u256, init: bool) {
        if (init) {
            // This line is important. It ensures that this function can't be called in the future.
            // If you remove this check, someone could call your constructor function and reset your smart contract.
            assert(Context.isDeployingContract());
            Storage.set(this.NUMBER_OF_VALIDATORS_KEY, unwrapStaticArray(_validatorsCount.toUint8Array()));
            Storage.set(this.TOTAL_SUPPLY_KEY, unwrapStaticArray((_validatorsCount * this.ONE).toUint8Array()));
        }
    }

    abstract _addresses(): Address[];
    abstract _isValidator(_validator: Address): bool;

    _assertValidSetup(_validatorsCount: u256): void {
        let list = _addresses();
        assert(list.length, _validatorsCount.toU32());
        for(let i: u256 = u256.Zero; i< _validatorsCount; i++) {
            assert(_isValidator(list[i]));
        }
    }
}
