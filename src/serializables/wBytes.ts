import { Args } from '@massalabs/massa-web3';
import { ISerializable, IDeserializedResult } from '@massalabs/massa-web3';

export class wBytes implements ISerializable<wBytes> {
    private arr: Uint8Array = new Uint8Array(0);

    constructor(arr: Uint8Array) {
        this.arr = arr;
    }

    serialize(): Uint8Array {
        let args = new Args().addUint8Array(this.arr);
        return new Uint8Array(args.serialize());
    }
    deserialize(data: Uint8Array, offset: number): IDeserializedResult<wBytes> {
        const args = new Args(data, offset);
        this.arr = args.nextUint8Array();
        return { instance: this, offset: args.getOffset() };
    }
}
