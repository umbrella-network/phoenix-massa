import {Args, IDeserializedResult, ISerializable} from "@massalabs/massa-web3";

export class EvmSignature implements ISerializable<EvmSignature> {
    private v: number = 0; // u8
    private r: Uint8Array = new Uint8Array(32);
    private s: Uint8Array = new Uint8Array(32);

    constructor(v: number, r: Uint8Array, s: Uint8Array) {
        if (r.length != 32 || s.length != 32) {
            throw new Error("Expect r & s length == 32");
        }

        this.v = v;
        this.r = r;
        this.s = s;
    }

    serialize(): Uint8Array {
        let args = new Args()
            .addU8(this.v)
            .addUint8Array(this.r)
            .addUint8Array(this.s)
        return new Uint8Array(args.serialize());
    }
    deserialize(data: Uint8Array, offset: number): IDeserializedResult<EvmSignature> {
        const args = new Args(data, offset);
        this.v = parseInt(args.nextU8().toString());
        this.r = args.nextUint8Array();
        this.s = args.nextUint8Array();
        return { instance: this, offset: args.getOffset() };
    }
}
