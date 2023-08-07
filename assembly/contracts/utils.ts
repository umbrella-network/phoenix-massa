import {Args, Result, Serializable} from "@massalabs/as-types";

export class wBytes implements Serializable {
    public data: StaticArray<u8>

    constructor(data: StaticArray<u8> = new StaticArray<u8>(0)) {
        this.data = data;
    }

    public serialize(): StaticArray<u8> {
        const args = new Args();
        args.add(this.data);
        return args.serialize();
    }

    public deserialize(data: StaticArray<u8>, offset: i32 = 0): Result<i32> {
        const args = new Args(data, offset);
        this.data = args.nextBytes().expect("Cannot get bytes");
        return new Result(args.offset);
    }

    public toString(): string {
        return this.data.toString();
    }
}
