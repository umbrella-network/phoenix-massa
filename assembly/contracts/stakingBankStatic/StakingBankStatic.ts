import { u128, u256 } from 'as-bignum/assembly';

import {
    Address,
    Storage,
    Context
} from "@massalabs/massa-as-sdk";

import {
    Args, Result,
    Serializable,
    stringToBytes,
    unwrapStaticArray
} from "@massalabs/as-types";
import {EvmAddress} from "../utils";
import {Bytes32} from "../onChainFeeds/UmbrellaFeedsCommon";


export class Validator implements Serializable {
    id: string;
    location: string;

    constructor(id: string, location: string) {
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
        this.location = args.nextString().expect("Can't deserialize location");
        return new Result(args.offset);
    }

    public toString(): string {
        return `[Validator] id: ${this.id} - loc: ${this.location}`;
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

    // function balances(address _validator) external view returns (uint256)
    balances(_validator: EvmAddress): u256 {
        if (this._isValidator(_validator)) {
            return u256.One;
        } else {
            return u256.Zero;
        }
    }

    // function verifyValidators(address[] calldata _validators) external view returns (bool)
    verifyValidators(_validators: string[]): bool {
        for (let i = 0; i < _validators.length; i++) {
            if (!this._isValidator(_validators[i])) {
                return false;
            }
        }
        return true;
    }

    // function getNumberOfValidators() external view returns (uint256)
    getNumberOfValidators(): u256 {
        return u256.Zero;
    }

    // function getAddresses() external view returns (address[] memory)
    getAddresses(): string[] {
        return this._addresses();
    }

    // function getBalances() external view returns (uint256[] memory allBalances)
    // TODO
    addresses(_ix: i32): string {
        return this._addresses()[_ix];
    }

    // TODO
    // function validators(address _id) external view virtual returns (address id, string memory location);
    // TODO
    // function balanceOf(address _account) external view returns (uint256) {
    // TODO
    // function totalSupply() external view returns (uint256) {
    // TODO

    getName(): Bytes32 {
        return new Bytes32().add("StakingBank");
    }

    /// @dev to follow Registrable interface
    register(): void {
        // there are no requirements atm
    }

    /// @dev to follow Registrable interface
    unregister(): void {
        // there are no requirements atm
    }

    // function _addresses() internal view virtual returns (address[] memory);
    abstract _addresses(): string[];
    // function _isValidator(address _validator) internal view virtual returns (bool);
    abstract _isValidator(_validator: string): bool;

    // function _assertValidSetup(uint256 _validatorsCount) internal view virtual
    _assertValidSetup(_validatorsCount: u256): void {
        let list = this._addresses();
        assert(list.length, _validatorsCount.toU32());
        for(let i = 0; i< list.length; i++) {
             assert(this._isValidator(list[i]));
        }
    }
}
