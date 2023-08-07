import {strToBytes} from "../utils";

export class Bytes32 {

    private MAX_LEN: number = 32;
    // private _offset: number = 0;
    protected serialized: Uint8Array = new Uint8Array(32);
    protected offset_ser: number = 0;

    /*
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
    */

    addString(arg: string): Bytes32 {
        let _arg = strToBytes(arg);
        if (this.offset_ser + arg.length > this.MAX_LEN) {
            throw new Error("Len > 32");
        }
        this.serialized.set(_arg, this.offset_ser);
        this.offset_ser += arg.length;

        return this;
    }

    public serialize(): Uint8Array {
        return this.serialized;
    }
}
