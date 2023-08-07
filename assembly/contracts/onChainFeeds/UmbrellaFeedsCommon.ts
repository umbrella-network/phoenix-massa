import { u128, u256 } from 'as-bignum/assembly';

import {
    Args,
    Result,
    Serializable,
    stringToBytes,
    toBytes
} from '@massalabs/as-types';

export class PriceData implements Serializable {
    /// @dev this is placeholder, that can be used for some additional data
    /// atm of creating this smart contract, it is only used as marker for removed data (when == type(uint8).max)
    public data: u8;
    /// @dev heartbeat: how often price data will be refreshed in case price stay flat
    public heartbeat: u32; // FIXME: u24
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

// Emulate abi.encodePacked
export class ArgsPacked {
    private _offset: i32 = 0;
    private serialized: StaticArray<u8> = new StaticArray<u8>(0);

    constructor(serialized: StaticArray<u8> = [], offset: i32 = 0) {
        this.serialized = serialized;
        this._offset = offset;
    }

    serialize(): StaticArray<u8> {
        return this.serialized;
    }

    add<T>(arg: T): ArgsPacked {
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
    private _offset: i32 = 0;
    private serialized: StaticArray<u8> = new StaticArray<u8>(32);
    private offset_ser: i32 = 0;

    add<T>(arg: T): Bytes32 {

        let len = this.serialized.length;

        if (arg instanceof StaticArray<u8>) {
            assert(this.offset_ser + arg.length <= this.MAX_LEN);

            // FIXME: can only use memory.copy if managed
            // check: https://github.com/AssemblyScript/assemblyscript/blob/main/std/assembly/staticarray.ts
            //        fromArray
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

            // FIXME: can only use memory.copy if managed
            // check: https://github.com/AssemblyScript/assemblyscript/blob/main/std/assembly/staticarray.ts
            //        fromArray
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

/*
export class Bytes53 extends BytesLen {
    @inline
    MAX_LEN(): i32 {
        return 53;
    }

    add<T>(arg: T): Bytes53 {
        return changetype<Bytes53>(this._add(arg));
    }
}
*/

// Emulate abi.encodeWithSelector
export class ArgsWithSelector {
    private serialized: StaticArray<u8> = new StaticArray<u8>(8);

    constructor(selector: Bytes4) {
        this.serialized = new StaticArray<u8>(4);
        memory.copy(changetype<usize>(this.serialized), changetype<usize>(selector.serialized), 4);
    }

    serialize(): StaticArray<u8> {
        return this.serialized;
    }

    add<T>(arg: T): ArgsWithSelector {
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
