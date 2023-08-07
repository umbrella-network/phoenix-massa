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

const VALIDATOR_0 = new Address("0xE3bDa0C6E1fBB111091Dfef6f22a673b20Ea5F50");
const VALIDATOR_1 = new Address("0xc1773490F00963CBAb3841fc07C1a0796E658Ba2");

class StakingBankStaticDev extends StakingBankStatic {

    constructor(_validatorsCount: u256, init: bool) {
        super(_validatorsCount, init);
    }

    validators(_id: Address): Validator {
        if (_id == VALIDATOR_0) {
            return new Validator(_id, "https://validator.sbx.umb.network");
        }
        if (_id == VALIDATOR_1) {
            return new Validator(_id, "https://validator2.sbx.umb.network");
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
