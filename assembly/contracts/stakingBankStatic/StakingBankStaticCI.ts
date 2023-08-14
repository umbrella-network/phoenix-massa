import { u128, u256 } from "as-bignum/assembly";

import {
    Address,
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

// 0x87630b2d1de0fbd5044eb6891b3d9d98c34c8d310c852f98550ba774480e47cc
const VALIDATOR_0 = EvmAddress.fromHex("0x2fFd013AaA7B5a7DA93336C2251075202b33FB2B");
// 0x3f1e8b94c70206bf816c1ed0b15ad98bdf225ae4c6e7e4eee6cdbcf706fda2ae
const VALIDATOR_1 = EvmAddress.fromHex("0x43158ea338Ff13D0bDa0c3EB969B9EA5a624E7Cc");
// 0x5da6b84117504d06b5dcd52b990d76965d2882f4e5852eb610bc76e4209b10d7
const VALIDATOR_2 = EvmAddress.fromHex("0x9Fd8DD0627b9A32399Fd115c4725C7e17BC40e6d");
// 0x1e5012671de3332ad0b43661984e94ab0e405bffddc9d3e863055040bab354b8
const VALIDATOR_3 = EvmAddress.fromHex("0xa3F3659E469b7aE0b249546338DEdc0b684edB05");
// 0x0edc1e35ea7701ddac703286674e79f04addbf5d2f6162fabc19d39bd3dc6662
const VALIDATOR_4 = EvmAddress.fromHex("0xB98A954B9036DF144d685E910bfbAEC6B33A8d11");
// 0x23c601ae397441f3ef6f1075dcb0031ff17fb079837beadaf3c84d96c6f3e569
const VALIDATOR_5 = EvmAddress.fromHex("0xE5904695748fe4A84b40b3fc79De2277660BD1D3");

class StakingBankStaticCI extends StakingBankStatic {

    constructor(_validatorsCount: u256 = u256.Zero, init: bool = false) {
        super(_validatorsCount, init);
    }

    validators(_id: EvmAddress): Validator {
        if (_id == VALIDATOR_0) {
            return new Validator(_id, "https://validator.dev.umb.network");
        }
        if (_id == VALIDATOR_1) {
            return new Validator(_id, "https://validator2.dev.umb.network");
        }
        if (_id == VALIDATOR_2) {
            return new Validator(_id, "https://validator3.ci.umb.network");
        }
        if (_id == VALIDATOR_3) {
            return new Validator(_id, "https://validator4.ci.umb.network");
        }
        if (_id == VALIDATOR_4) {
            return new Validator(_id, "https://validator5.ci.umb.network");
        }
        if (_id == VALIDATOR_5) {
            return new Validator(_id, "https://validator6.ci.umb.network");
        }

        return new Validator(new EvmAddress(), "");
    }

    _addresses(): EvmAddress[] {
        const NUMBER_OF_VALIDATORS = u256.fromUint8ArrayLE(wrapStaticArray(Storage.get(this.NUMBER_OF_VALIDATORS_KEY)));
        let list = new Array<EvmAddress>(NUMBER_OF_VALIDATORS.toU32());

        list[0] = VALIDATOR_0;
        list[1] = VALIDATOR_1;
        list[2] = VALIDATOR_2;
        list[3] = VALIDATOR_3;
        list[4] = VALIDATOR_4;
        list[5] = VALIDATOR_5;

        return list;
    }

    _isValidator(_validator: EvmAddress): bool {
        return (_validator == VALIDATOR_0
            || _validator == VALIDATOR_1
            || _validator == VALIDATOR_2
            || _validator == VALIDATOR_3
            || _validator == VALIDATOR_4
            || _validator == VALIDATOR_5
        );
    }
}

export function constructor(_validatorsCount: u256): void {
    let stb = new StakingBankStaticCI(_validatorsCount, true);
}

export function validators(args: StaticArray<u8>): StaticArray<u8> {
    let _id: EvmAddress = new Args(args).nextSerializable<EvmAddress>().expect("Cannot deserialize _id");
    let stb = new StakingBankStaticCI();
    let validator: Validator = stb.validators(_id);
    return new Args().add(validator).serialize();
}

export function verifyValidators(_args: StaticArray<u8>): StaticArray<u8> {
    let args = new Args();
    let addresses = args.nextSerializableObjectArray<EvmAddress>().expect("Cannot deser addresses");
    let stb = new StakingBankStaticCI();
    let ret = stb.verifyValidators(addresses);
    return new Args().add(ret).serialize();
}
