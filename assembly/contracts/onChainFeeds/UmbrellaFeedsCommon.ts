import { u128, u256 } from 'as-bignum/assembly';

import {
    Args,
    Result,
    Serializable,
    stringToBytes,
    toBytes, wrapStaticArray
} from '@massalabs/as-types';

export class PriceData implements Serializable {
    /// @dev this is placeholder, that can be used for some additional data
    /// atm of creating this smart contract, it is only used as marker for removed data (when == type(uint8).max)
    public data: u8;
    /// @dev heartbeat: how often price data will be refreshed in case price stay flat
    public heartbeat: u32; // Note: original type was: u24
    /// @dev timestamp: price time, at this time validators run consensus
    public timestamp: u32;
    /// @dev price
    public price: u128;

    constructor(data: u8 = 0, heartbeat: u32 = 0, timestamp: u32 = 0, price: u128 = u128.Zero) {
        this.data = data;
        this.heartbeat = heartbeat;
        this.timestamp = timestamp;
        this.price = price;
    }

    public serialize(): StaticArray<u8> {
        const args = new Args();
        args.add(this.data);
        args.add(this.heartbeat);
        args.add(this.timestamp);
        args.add(this.price);
        return args.serialize();
    }

    public deserialize(data: StaticArray<u8>, offset: i32 = 0): Result<i32> {
        const args = new Args(data, offset);
        this.data = args.nextU8().expect("Can't deserialize data");
        this.heartbeat = args.nextU32().expect("Can't deserialize heartbeat");
        this.timestamp = args.nextU32().expect("Can't deserialize ts");
        this.price = args.nextU128().expect("Can't deserialize price");
        return new Result(args.offset);
    }

    public toString(): string {
        return `PriceData: ${this.price}, h: ${this.heartbeat}, ts: ${this.timestamp}`;
    }
}

// Emulate abi.encode
// Note: in order to add a class you need to add each field one by one
export class AbiEncode {
    private serialized: StaticArray<u8> = new StaticArray<u8>(0);
    constructor(serialized: StaticArray<u8> = []) {
        this.serialized = serialized;
    }

    serialize(): StaticArray<u8> {
        return this.serialized;
    }

    add<T>(arg: T): AbiEncode {
        if (arg instanceof u8) {
            let arg_32 = new StaticArray<u8>(32-sizeof<T>()).concat(toBytes(arg));
            this.serialized = this.serialized.concat(arg_32);
        } else if (arg instanceof u16) {
            let arg_32 = new StaticArray<u8>(32-sizeof<T>()).concat(toBytes(bswap(arg)));
            this.serialized = this.serialized.concat(arg_32);
        } else if (arg instanceof u32) {
            let arg_32 = new StaticArray<u8>(32-sizeof<T>()).concat(toBytes(bswap(arg)));
            this.serialized = this.serialized.concat(arg_32);
        } else if (arg instanceof u128) {
            this.serialized = this.serialized.concat(arg.toStaticBytes(true));
        } else if (arg instanceof u256) {
            this.serialized = this.serialized.concat(arg.toStaticBytes(true));
        } else if (arg instanceof string) {
            let _arg = stringToBytes(arg)
            // Offset to string data?
            let offset: u32 = this.serialized.length + 32;
            let arg1_32 = new StaticArray<u8>(32-sizeof<u32>()).concat(toBytes(bswap(offset)));
            this.serialized = this.serialized.concat(arg1_32);
            // String as bytes length
            let str_len: u32 = _arg.length;
            let arg2_32 = new StaticArray<u8>(32-sizeof<u32>()).concat(toBytes(bswap(str_len)));
            this.serialized = this.serialized.concat(arg2_32);
            // String as bytes
            let chunk = i32(_arg.length / 32);
            if (_arg.length % 32 != 0) {
                chunk += 1;
            }
            for(let i = 0; i< chunk; i++) {

                let start_offset = i*32;
                let end_offset = (i+1)*32;
                if (end_offset > _arg.length) {
                    end_offset = _arg.length;
                }
                let _bytes = _arg.slice<StaticArray<u8>>(start_offset, end_offset);
                let b32 = new Bytes32().add(_bytes);
                this.serialized = this.serialized.concat(b32.serialize());
            }
        } else if (arg instanceof Bytes32) {
            this.serialized = this.serialized.concat(arg.serialize());
        } else {
            ERROR("[AbiEncode] Do not know how to serialize the given type");
        }
        return this;
    }
}

// Emulate abi.encodePacked
export class AbiEncodePacked {
    private _offset: i32 = 0;
    private serialized: StaticArray<u8> = new StaticArray<u8>(0);

    constructor(serialized: StaticArray<u8> = [], offset: i32 = 0) {
        this.serialized = serialized;
        this._offset = offset;
    }

    serialize(): StaticArray<u8> {
        return this.serialized;
    }

    add<T>(arg: T): AbiEncodePacked {
        if (arg instanceof u8) {
            this.serialized = this.serialized.concat(toBytes(arg));
        } else if (arg instanceof u16) {
            this.serialized = this.serialized.concat(toBytes(bswap(arg)));
        } else if (arg instanceof u32) {
            this.serialized = this.serialized.concat(toBytes(bswap(arg)));
        } else if (arg instanceof string) {
            this.serialized = this.serialized.concat(stringToBytes(arg));
        } else if (arg instanceof StaticArray<u8>) {
            this.serialized = this.serialized.concat(arg);
        } else {
            ERROR("Do not know how to serialize the given type");
        }
        return this;
    }
}

export class Bytes32 {

    private MAX_LEN: i32 = 32;
    // private _offset: i32 = 0;
    private serialized: StaticArray<u8> = new StaticArray<u8>(32);
    private offset_ser: i32 = 0;

    add<T>(arg: T): Bytes32 {

        let len = this.serialized.length;

        if (arg instanceof StaticArray<u8>) {
            assert(this.offset_ser + arg.length <= this.MAX_LEN);
            memory.copy(changetype<usize>(this.serialized) + this.offset_ser, changetype<usize>(arg), arg.length);
            this.offset_ser += arg.length;

        } else if (arg instanceof string) {
            let _arg = stringToBytes(arg);
            assert(this.offset_ser + arg.length <= this.MAX_LEN);
            memory.copy(changetype<usize>(this.serialized) + this.offset_ser, changetype<usize>(_arg), _arg.length);
            this.offset_ser += arg.length;
        }
        else {
            ERROR("Do not know how to serialize the given type");
        }
        return this;
    }

    serialize(): StaticArray<u8> {
        return this.serialized;
    }
}

abstract class BytesLen implements Serializable {

    private serialized: StaticArray<u8> = new StaticArray<u8>(0);
    private offset_ser: i32 = 0;

    abstract MAX_LEN(): i32;

    constructor() {
        this.serialized = new StaticArray<u8>(this.MAX_LEN());
    }

    _add<T>(arg: T): this {

        const MAX_LEN = this.MAX_LEN();
        if (arg instanceof StaticArray<u8>) {
            assert(this.offset_ser + arg.length <= MAX_LEN);
            memory.copy(changetype<usize>(this.serialized) + this.offset_ser, changetype<usize>(arg), arg.length);
            this.offset_ser += arg.length;
        } else if (arg instanceof string) {
            let _arg = stringToBytes(arg);
            assert(this.offset_ser + arg.length <= MAX_LEN);
            memory.copy(changetype<usize>(this.serialized) + this.offset_ser, changetype<usize>(_arg), _arg.length);
            this.offset_ser += arg.length;
        }
        else {
            ERROR("Do not know how to serialize the given type");
        }
        return this;
    }

    public serialize(): StaticArray<u8> {
        return this.serialized;
    }

    public deserialize(data: StaticArray<u8>, offset: i32 = 0): Result<i32> {
        const args = new Args(data, offset);
        this.serialized = args.getNextData(this.MAX_LEN());
        return new Result(args.offset);
    }

}

export class Bytes4 extends BytesLen {
    @inline
    MAX_LEN(): i32 {
        return 4;
    }

    add<T>(arg: T): Bytes4 {
        return changetype<Bytes4>(this._add(arg));
    }
}

// Emulate abi.encodeWithSelector
export class AbiEncodeWithSelector {
    private serialized: StaticArray<u8> = new StaticArray<u8>(8);

    constructor(selector: Bytes4) {
        this.serialized = new StaticArray<u8>(4);
        memory.copy(changetype<usize>(this.serialized), changetype<usize>(selector.serialized), 4);
    }

    serialize(): StaticArray<u8> {
        return this.serialized;
    }

    add<T>(arg: T): AbiEncodeWithSelector {
        if (arg instanceof u8) {
            let arg_32 = new StaticArray<u8>(32-sizeof<T>()).concat(toBytes(arg));
            this.serialized = this.serialized.concat(arg_32);
        } else if (arg instanceof u16) {
            let arg_32 = new StaticArray<u8>(32-sizeof<T>()).concat(toBytes(bswap(arg)));
            this.serialized = this.serialized.concat(arg_32);
        } else if (arg instanceof Bytes32) {
            this.serialized = this.serialized.concat(arg.serialize());
        } else {
            ERROR("Do not know how to serialize the given type");
        }
        return this;
    }
}

// A Serializable Result
export class SResult<T extends Serializable> extends Result<T> implements Serializable {

    constructor(value: T | null = null, error: string | null = null) {

        // Hack to allow ser / deser
        if (value != null) {
            super(value, error);
        } else {
            super(instantiate<T>(), error);
        }

        /*
        if (value != null) {
            super(value, error);
        } else if (value == null && error == null) {
            super(instantiate<T>(), null);
        } else {
            super(instantiate<T>(), error);
        }
        */
    }

    serialize(): StaticArray<u8> {
        if (this.isOk()) {
            return new Args()
                .add<u8>(0)
                .add<T>(this.unwrap())
                .serialize();
        } else {
            // Note: do not ser error msg as it is unused
            return new Args()
                .add<u8>(1)
                .serialize();
        }
    }

    public deserialize(data: StaticArray<u8>, offset: i32 = 0): Result<i32> {
        const args = new Args(data, offset);

        let kind = args.nextU8().expect("Cannot deser Result u8");
        if (kind == 0) {
            // Ok
            this.value = args
                .nextSerializable<T>()
                .expect("Cannot deser Result T");
        } else {
            // Err
            this.error = "ERROR";
        }

        // this. = args.getNextData(this.MAX_LEN());
        return new Result(args.offset);
    }

    public toString(): string {
        if (this.isOk()) {
            return `Ok(${this.value.toString()})`;
        } else {
            return 'Err';
        }
    }
}

/*
// In Solidity, evm address can be converted to uint160 (and then compared)
// As we don't have u160 in AS, we convert here to 256
export function evmAddressToU256(addr: StaticArray<u8>): u256 {
    assert(addr.length == 20, "Expect evm address length to be 20");
    let withPad = new StaticArray<u8>(12).concat(addr);
    return u256.fromUint8ArrayBE(wrapStaticArray(withPad));
}
*/

// Convert bytes array (length 32) to u256
// In Solidity, you can see code like:
// (uint8 v, bytes32 r, bytes32 s) = ...
// if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
//     revert ECDSAInvalidSignatureS();
// }
export function bytes32ToU256(a: StaticArray<u8>): u256 {
    return u256.fromUint8ArrayBE(wrapStaticArray(a));
}