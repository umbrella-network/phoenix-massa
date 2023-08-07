import { u128, u256 } from "as-bignum/assembly";

import {
    Address,
    Storage,
    Context
} from "@massalabs/massa-as-sdk";

import {
    wrapStaticArray,
    Args,
    serializableObjectsArrayToBytes
} from '@massalabs/as-types';

import {
    // NUMBER_OF_VALIDATORS_KEY,
    Validator,
    StakingBankStatic
} from "./StakingBankStatic";

const VALIDATOR_0 = new Address("0xDc3eBc37DA53A644D67E5E3b5BA4EEF88D969d5C");
const VALIDATOR_1 = new Address("0x998cb7821e605cC16b6174e7C50E19ADb2Dd2fB0");

class StakingBankStaticDev extends StakingBankStatic {

    constructor(_validatorsCount: u256, init: bool) {
        super(_validatorsCount, init);
    }

    validators(_id: Address): Validator {
        if (_id == VALIDATOR_0) {
            return new Validator(_id, "https://validator.dev.umb.network");
        }
        if (_id == VALIDATOR_1) {
            return new Validator(_id, "https://validator2.dev.umb.network");
        }

        return new Validator(new Address("0"), "");
    }

    _addresses(): Address[] {
        const NUMBER_OF_VALIDATORS = u256.fromUint8ArrayLE(wrapStaticArray(Storage.get(this.NUMBER_OF_VALIDATORS_KEY)));
        let list = new Array<Address>(NUMBER_OF_VALIDATORS.toU32());

        list[0] = VALIDATOR_0;
        list[1] = VALIDATOR_1;

        return list;
    }

    _isValidator(_validator: Address): bool {
        return (_validator == VALIDATOR_0 || _validator == VALIDATOR_1);
    }
}

export function constructor(args: StaticArray<u8>): void {
    let _validatorsCount: u256 = new Args(args).nextU256().expect("Cannot deserialize _validatorsCount");
    let stb = new StakingBankStaticDev(_validatorsCount, true);
    return;
}

export function validators(args: StaticArray<u8>): StaticArray<u8> {
    let _id: Address = new Args(args).nextSerializable<Address>().expect("Cannot deserialize _id");
    let stb = new StakingBankStaticDev(u256.Zero, false);
    let validator: Validator = stb.validators(_id);
    return new Args().add(validator).serialize();
}
