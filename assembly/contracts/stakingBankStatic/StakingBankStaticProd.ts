import { u256 } from "as-bignum/assembly";

import {
    getBytecode, keccak256,
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

// Validator 0 Public Key
const VALIDATOR_0: string = "P12W6zgQb5aykbYSz4CfQLuk3axRcp5jYX1fmBT7VRdgVnzv6oHH";
// Validator 1 Public Key
const VALIDATOR_1: string = "P1QV6AsrtPdZqk9BVyMMfFCDgYEaMaSBatnCk8xs1jJzcMGNeFa";
// https://umbrella.artemahr.tech
const VALIDATOR_2: string = "P1241HUkWn3JiFR1DaFAeHs45W28cGyuXo7UuZW7YD8HTqJBYjuL";
// https://umb.vtabsolutions.com:3030
const VALIDATOR_3: string = "P1ApngdeUh6mVFmraDuajEX7k47yGftDGCQvY8eY4BritMwjwcF";
// https://umbrella.crazywhale.es
const VALIDATOR_4: string = "P12grHhPHfvRhujjLfdDzN4yvoPC1XkdehPVW7HB9kjJkXDzKXJL";
// https://umbrella-node.gateomega.com
const VALIDATOR_5: string = "P1FW2ey9wCEhgmtHV1QGqbrcivXawYv1mY75tRZJao8d4gfzgMm";
// https://umb.anorak.technology
const VALIDATOR_6: string = "P12TJwFzkrgT5fQ3gJiUTpeQei6D2kQV2SRCoHhNbcXj4CqDoQkC";
// temp https://umbrella.validator.infstones.io MISSING SETUP
const VALIDATOR_7: string = "P1QV6AsrtPdZqk9BVyMMfFCDgYEaMaSBatnCk8xs1jJzcMGNeAF";
// https://umb.hashkey.cloud
const VALIDATOR_8: string = "P129pqQxdWEzyVhvp8jtxkdx62jV2RASdNDAHepMZuUnFHekMnBv";
// http://umbrella.staking4all.org:3000
const VALIDATOR_9: string = "P12S51EKn4h7NYVLKk2AXycPzPECGCupuFS6DTeMe1yWmGqrnQ2n";
// http://5.161.78.230:3000
const VALIDATOR_10: string = "P1gN7svCytzkDegn3BAnHdtaT1nQux7krzFbj3KiweHgJFnJPpy";
// https://umb-api.staking.rocks
const VALIDATOR_11: string = "P1UVGmWSxGxxJqkvauTHuidv2dP9PsdhBEk2vTSXTw59U2ycbQc";
// https://umb.urbanremote.net
const VALIDATOR_12: string = "P1cciVGrADZH1gPnNy1sXu2Q2Gmh4eLrdy5XPhFm7yXhbaigNeT";
// https://umbrella-node.ankastake.com
const VALIDATOR_13: string = "P1APYAhYh65R7tGxAsPCi2a3YwWdft8jVrmSSn7BZej3tmxRhPf";
// https://umbrella.tchambrella.com
const VALIDATOR_14: string = "P12DjfaK36WN5dVQXKmrjT1MszosKVNViXMvqAnm6wbrV3YLtzqk";


class StakingBankStaticProd extends StakingBankStatic {

    constructor(_validatorsCount: u256 = u256.Zero, init: bool = false) {
        super(_validatorsCount, init);
    }

    validators(_id: string): Validator {
        if (_id == VALIDATOR_0) {
            return new Validator(_id, "https://validator.umb.network");
        }
        if (_id == VALIDATOR_1) {
            return new Validator(_id, "https://validator2.umb.network");
        }
        if (_id == VALIDATOR_2) {
            return new Validator(_id, "https://umbrella.artemahr.tech");
        }
        if (_id == VALIDATOR_3) {
            return new Validator(_id, "https://umb.vtabsolutions.com:3030");
        }
        if (_id == VALIDATOR_4) {
            return new Validator(_id, "https://umbrella.crazywhale.es");
        }
        if (_id == VALIDATOR_5) {
            return new Validator(_id, "https://umbrella-node.gateomega.com");
        }
        if (_id == VALIDATOR_6) {
            return new Validator(_id, "https://umb.anorak.technology");
        }
        if (_id == VALIDATOR_7) {
            return new Validator(_id, "https://umbrella.validator.infstones.io");
        }
        if (_id == VALIDATOR_8) {
            return new Validator(_id, "https://umb.hashkey.cloud");
        }
        if (_id == VALIDATOR_9) {
            return new Validator(_id, "http://umbrella.staking4all.org:3000");
        }
        if (_id == VALIDATOR_10) {
            return new Validator(_id, "http://5.161.78.230:3000");
        }
        if (_id == VALIDATOR_11) {
            return new Validator(_id, "https://umb-api.staking.rocks");
        }
        if (_id == VALIDATOR_12) {
            return new Validator(_id, "https://umb.urbanremote.net");
        }
        if (_id == VALIDATOR_13) {
            return new Validator(_id, "https://umbrella-node.ankastake.com");
        }
        if (_id == VALIDATOR_14) {
            return new Validator(_id, "https://umbrella.tchambrella.com");
        }

        return new Validator("", "");
    }

    _addresses(): string[] {
        const NUMBER_OF_VALIDATORS = u256.fromUint8ArrayLE(wrapStaticArray(Storage.get(this.NUMBER_OF_VALIDATORS_KEY)));
        let list = new Array<string>(NUMBER_OF_VALIDATORS.toU32());

        list[0] = VALIDATOR_0;
        list[1] = VALIDATOR_1;
        list[2] = VALIDATOR_2;
        list[3] = VALIDATOR_3;
        list[4] = VALIDATOR_4;
        list[5] = VALIDATOR_5;
        list[6] = VALIDATOR_6;
        list[7] = VALIDATOR_7;
        list[8] = VALIDATOR_8;
        list[9] = VALIDATOR_9;
        list[10] = VALIDATOR_10;
        list[11] = VALIDATOR_11;
        list[12] = VALIDATOR_12;
        list[13] = VALIDATOR_13;
        list[14] = VALIDATOR_14;

        return list;
    }

    _isValidator(_validator: string): bool {
        return (_validator == VALIDATOR_0
            || _validator == VALIDATOR_1
            || _validator == VALIDATOR_2
            || _validator == VALIDATOR_3
            || _validator == VALIDATOR_4
            || _validator == VALIDATOR_5
            || _validator == VALIDATOR_6
            || _validator == VALIDATOR_7
            || _validator == VALIDATOR_8
            || _validator == VALIDATOR_9
            || _validator == VALIDATOR_10
            || _validator == VALIDATOR_11
            || _validator == VALIDATOR_12
            || _validator == VALIDATOR_13
            || _validator == VALIDATOR_14
        );
    }
}

export function constructor(args: StaticArray<u8>): void {
    let _validatorsCount: u256 = new Args(args).nextU256().expect("Cannot get _validatorsCount");
    let stb = new StakingBankStaticProd(_validatorsCount, true);
    return;
}

export function validators(args: StaticArray<u8>): StaticArray<u8> {
    let _id = new Args(args).nextString().expect("Cannot get _id");
    let stb = new StakingBankStaticProd();
    let validator: Validator = stb.validators(_id);
    return new Args().add(validator).serialize();
}

export function verifyValidators(_args: StaticArray<u8>): StaticArray<u8> {
    let args = new Args(_args);
    let addresses = args.nextStringArray().expect("Cannot get addresses");
    let stb = new StakingBankStaticProd();
    let ret = stb.verifyValidators(addresses);
    return new Args().add(ret).serialize();
}

export function addresses(_args: StaticArray<u8>): StaticArray<u8> {
    let args = new Args(_args);
    let index = args.nextI32().expect("Cannot get index");
    let stb = new StakingBankStaticProd();
    let ret = stb.addresses(index);
    return new Args().add(ret).serialize();
}

export function getAddresses(): StaticArray<u8> {
    let stb = new StakingBankStaticProd();
    let ret = stb.getAddresses();
    return new Args().add(ret).serialize();
}

export function getDeployedBytecodeHash(): StaticArray<u8> {
    let bytecode = getBytecode();
    return new Args().add(keccak256(bytecode)).serialize();
}
