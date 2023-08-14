import { u128, u256 } from "as-bignum/assembly";

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

const VALIDATOR_0 =  EvmAddress.fromHex("0x977Ba523420110e230643B772Fe9cF955e11dA7B");
const VALIDATOR_1 =  EvmAddress.fromHex("0xe2422b23e52bc13ebA04d7FbB9F332Deb43360fB");
// external order is based on validators submits on AVAX for Apr 2023
const VALIDATOR_2 =  EvmAddress.fromHex("0x57F404aD75e371c1A539589C1eFCA12e0C6980AD");
const VALIDATOR_3 =  EvmAddress.fromHex("0xD56C6A4f64E0bD70260472d1DB6Cf5825858CB0d");
const VALIDATOR_4 =  EvmAddress.fromHex("0x220230Eda8f50067Dd9e4729345dabCCe0C61542");
const VALIDATOR_5 =  EvmAddress.fromHex("0x93FdcAB283b0BcAc48157590af482E1CFd6af6aC");
const VALIDATOR_6 =  EvmAddress.fromHex("0xCd733E06B06083d52fC5867E8E3432aA5c103A38");
const VALIDATOR_7 =  EvmAddress.fromHex("0x42e210b110c6aa49CdfA7ceF1444Aa4719653111");
const VALIDATOR_8 =  EvmAddress.fromHex("0x501731c6a69803a53Ec6c3e12f293c247cE1092B");
const VALIDATOR_9 =  EvmAddress.fromHex("0x8bF9661F1b247522C75DD0FE84355aD2EfF27144");
const VALIDATOR_10 = EvmAddress.fromHex("0x281754Ab58391A478B7aA4E7f39991CfB41118c4");
const VALIDATOR_11 = EvmAddress.fromHex("0xB9C63a350A04d8BD245d18928a26EE036352dDd8");
const VALIDATOR_12 = EvmAddress.fromHex("0x57A51D5BDcE188c2295fCA3b4687475a54E65A02");
const VALIDATOR_13 = EvmAddress.fromHex("0x777FbA3666fa7747476a34577FcCC404b263E09F");
const VALIDATOR_14 = EvmAddress.fromHex("0x2F85824B2B38F179E451988670935d315b5b9692");
const VALIDATOR_15 = EvmAddress.fromHex("0xe868bE65C50b61E81A3fC5cB5A7916090B05eb2A");
const VALIDATOR_16 = EvmAddress.fromHex("0xB12c5DFA8693a5890c4b5B9145E3CAE1502f17f0");
const VALIDATOR_17 = EvmAddress.fromHex("0xe7129A4c7521452511249c26B018fEfbB10d108d");

class StakingBankStaticProd extends StakingBankStatic {

    constructor(_validatorsCount: u256 = u256.Zero, init: bool = false) {
        super(_validatorsCount, init);
    }

    validators(_id: EvmAddress): Validator {
        // TODO: validator url
        if (_id == VALIDATOR_0) {
            return new Validator(_id, "");
        }
        if (_id == VALIDATOR_1) {
            return new Validator(_id, "k");
        }
        if (_id == VALIDATOR_2) {
            return new Validator(_id, "");
        }
        if (_id == VALIDATOR_3) {
            return new Validator(_id, "");
        }
        if (_id == VALIDATOR_4) {
            return new Validator(_id, "");
        }
        if (_id == VALIDATOR_5) {
            return new Validator(_id, "");
        }
        // TODO: all validator

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
        // TODO: all validator

        return list;
    }

    _isValidator(_validator: EvmAddress): bool {
        // TODO/ all validator
        return (_validator == VALIDATOR_0
            || _validator == VALIDATOR_1
            || _validator == VALIDATOR_2
            || _validator == VALIDATOR_3
            || _validator == VALIDATOR_4
            || _validator == VALIDATOR_5
        );
    }
}

export function constructor(args: StaticArray<u8>): void {
    let _validatorsCount: u256 = new Args(args).nextU256().expect("Cannot deserialize _validatorsCount");
    let stb = new StakingBankStaticProd(_validatorsCount, true);
    return;
}

export function validators(args: StaticArray<u8>): StaticArray<u8> {
    let _id: EvmAddress = new Args(args).nextSerializable<EvmAddress>().expect("Cannot deserialize _id");
    let stb = new StakingBankStaticProd();
    let validator: Validator = stb.validators(_id);
    return new Args().add(validator).serialize();
}

export function verifyValidators(_args: StaticArray<u8>): StaticArray<u8> {
    let args = new Args();
    let addresses = args.nextSerializableObjectArray<EvmAddress>().expect("Cannot deser addresses");
    let stb = new StakingBankStaticProd();
    let ret = stb.verifyValidators(addresses);
    return new Args().add(ret).serialize();
}
