import { u256 } from "as-bignum/assembly";

import {
    Storage,
    generateEvent, getBytecode, keccak256
} from "@massalabs/massa-as-sdk";

import {
    wrapStaticArray,
    Args,
} from '@massalabs/as-types';

import {
    Validator,
    StakingBankStatic
} from "./StakingBankStatic";

// Validator 0 Public Key
const VALIDATOR_0: string = "P1A8NuAPycwfdTiPVr75enmSUW2dRotcxCHiR1LSpZduHLDiERm";
// Validator 1 Public Key
const VALIDATOR_1: string = "P1dU2kKBMNRsnV2FNr4PVkXDFzUbVPHN5QLxSuo7X6vaYt5Gip7";

class StakingBankStaticDev extends StakingBankStatic {

    constructor(_validatorsCount: u256 = u256.Zero, init: bool = false) {
        super(_validatorsCount, init);
    }

    validators(_id: string): Validator {
        if (_id == VALIDATOR_0) {
            return new Validator(_id, "https://validator.dev.umb.network");
        }
        if (_id == VALIDATOR_1) {
            return new Validator(_id, "https://validator2.dev.umb.network");
        }

        return new Validator("", "");
    }

    _addresses(): string[] {
        const NUMBER_OF_VALIDATORS = u256.fromUint8ArrayLE(wrapStaticArray(Storage.get(this.NUMBER_OF_VALIDATORS_KEY)));
        let list = new Array<string>(NUMBER_OF_VALIDATORS.toU32());

        list[0] = VALIDATOR_0;
        list[1] = VALIDATOR_1;

        return list;
    }

    _isValidator(_validator: string): bool {
        return (_validator == VALIDATOR_0 || _validator == VALIDATOR_1);
    }
}

export function constructor(args: StaticArray<u8>): void {
    let _validatorsCount: u256 = new Args(args).nextU256().expect("Cannot deserialize _validatorsCount");
    let stb = new StakingBankStaticDev(_validatorsCount, true);
    return;
}

export function validators(args: StaticArray<u8>): StaticArray<u8> {
    let _id = new Args(args).nextString().expect("Cannot get _id");
    let stb = new StakingBankStaticDev();
    let validator: Validator = stb.validators(_id);
    if (ASC_OPTIMIZE_LEVEL == 0) {
        generateEvent(`[validators] ${validator}`);
    }
    return new Args().add(validator).serialize();
}

export function verifyValidators(_args: StaticArray<u8>): StaticArray<u8> {
    let args = new Args(_args);
    let addresses = args.nextStringArray().expect("Cannot get addresses");
    let stb = new StakingBankStaticDev();
    let ret = stb.verifyValidators(addresses);
    if (ASC_OPTIMIZE_LEVEL == 0) {
        generateEvent(`[verifyValidators] ${ret}`);
    }
    return new Args().add(ret).serialize();
}

export function addresses(_args: StaticArray<u8>): StaticArray<u8> {
    let args = new Args(_args);
    let index = args.nextI32().expect("Cannot get index");
    let stb = new StakingBankStaticDev();
    let ret = stb.addresses(index);
    return new Args().add(ret).serialize();
}

export function getAddresses(): StaticArray<u8> {
    let stb = new StakingBankStaticDev();
    let ret = stb.getAddresses();
    return new Args().add(ret).serialize();
}

export function getDeployedBytecodeHash(): StaticArray<u8> {
    let bytecode = getBytecode();
    return new Args().add(keccak256(bytecode)).serialize();
}
