import { u256 } from "as-bignum/assembly";

import {
    Storage
} from "@massalabs/massa-as-sdk";

import {
    Args,
    wrapStaticArray
} from '@massalabs/as-types';

import {
    Validator,
    StakingBankStatic
} from "./StakingBankStatic";
import {EvmAddress} from "../utils";

// Validator 0 Public Key
const VALIDATOR_0: string = "P129SxWyVEzZQUAZQ1B3He2z2HUWeo356expwRPahB8eisF7aGN2";
// Validator 1 Public Key
const VALIDATOR_1: string = "P188DpPCQpQ7BZEFrsvPumT5CNrGGeWbYTXFkqEVgBbSPjScYMy";

class StakingBankStaticSbx extends StakingBankStatic {

    constructor(_validatorsCount: u256 = u256.Zero, init: bool = false) {
        super(_validatorsCount, init);
    }

    validators(_id: EvmAddress): Validator {
        if (_id == VALIDATOR_0) {
            return new Validator(_id, "https://validator.sbx.umb.network");
        }
        if (_id == VALIDATOR_1) {
            return new Validator(_id, "https://validator2.sbx.umb.network");
        }

        return new Validator(new EvmAddress(), "");
    }

    _addresses(): EvmAddress[] {
        const NUMBER_OF_VALIDATORS = u256.fromUint8ArrayLE(wrapStaticArray(Storage.get(this.NUMBER_OF_VALIDATORS_KEY)));
        let list = new Array<EvmAddress>(NUMBER_OF_VALIDATORS.toU32());

        list[0] = VALIDATOR_0;
        list[1] = VALIDATOR_1;

        return list;
    }

    _isValidator(_validator: EvmAddress): bool {
        return (_validator == VALIDATOR_0 || _validator == VALIDATOR_1);
    }
}

export function constructor(args: StaticArray<u8>): void {
    let _validatorsCount: u256 = new Args(args).nextU256().expect("Cannot deserialize _validatorsCount");
    let stb = new StakingBankStaticSbx(_validatorsCount, true);
    return;
}

export function validators(args: StaticArray<u8>): StaticArray<u8> {
    let _id: EvmAddress = new Args(args).nextSerializable<EvmAddress>().expect("Cannot deserialize _id");
    let stb = new StakingBankStaticSbx();
    let validator: Validator = stb.validators(_id);
    return new Args().add(validator).serialize();
}

export function verifyValidators(_args: StaticArray<u8>): StaticArray<u8> {
    let args = new Args();
    let addresses = args.nextSerializableObjectArray<EvmAddress>().expect("Cannot deser addresses");
    let stb = new StakingBankStaticSbx();
    let ret = stb.verifyValidators(addresses);
    return new Args().add(ret).serialize();
}
