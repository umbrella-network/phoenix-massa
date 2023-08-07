import { u128, u256 } from "as-bignum/assembly";

import {
    Address,
    Storage
} from "@massalabs/massa-as-sdk";

import {
    wrapStaticArray
} from '@massalabs/as-types';

import {
    Validator,
    StakingBankStatic
} from "./StakingBankStatic";

const VALIDATOR_0 = new Address("0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4");

class StakingBankStaticDev extends StakingBankStatic {

    constructor(_validatorsCount: u256, init: bool) {
        super(_validatorsCount, init);
    }

    validators(_id: Address): Validator {
        if (_id == VALIDATOR_0) {
            return new Validator(_id, "localhost");
        }

        return new Validator(new Address("0"), "");
    }

    _addresses(): Address[] {
        const NUMBER_OF_VALIDATORS = u256.fromUint8ArrayLE(wrapStaticArray(Storage.get(this.NUMBER_OF_VALIDATORS_KEY)));
        let list = new Array<Address>(NUMBER_OF_VALIDATORS.toU32());

        list[0] = VALIDATOR_0;

        return list;
    }

    _isValidator(_validator: Address): bool {
        return (_validator == VALIDATOR_0);
    }
}

export function constructor(_validatorsCount: u256): void {
    let stb = new StakingBankStaticDev(_validatorsCount, true);
}

export function validators(_id: Address): Validator {
    let stb = new StakingBankStaticDev(u256.Zero, false);
    return stb.validators(_id);
}

export function _addresses(): Address[] {
    let stb = new StakingBankStaticDev(u256.Zero, false);
    return stb._addresses();
}
