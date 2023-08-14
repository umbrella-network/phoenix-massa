import {Args, IDeserializedResult, ISerializable} from "@massalabs/massa-web3";

const EVM_ADDRESS_DATA_LEN = 20;
export class EvmAddress implements ISerializable<EvmAddress> {
    private arr: Uint8Array;

    constructor(arr: Uint8Array = new Uint8Array(EVM_ADDRESS_DATA_LEN)) {
        this.arr = arr;
    }

    public static fromHex(hex: string): EvmAddress {
        // assert(hex.length == 40);
        let bytes = new Uint8Array(EVM_ADDRESS_DATA_LEN);
        let j = 0;
        for (let c = 0; c < hex.length; c += 2) {
            bytes[j] = parseInt(hex.substr(c, 2), 16);
            j += 1;
        }

        return new EvmAddress(bytes);
    }

    serialize(): Uint8Array {
        let args = new Args().addUint8Array(this.arr);
        return new Uint8Array(args.serialize());
    }
    deserialize(data: Uint8Array, offset: number): IDeserializedResult<EvmAddress> {
        const args = new Args(data, offset);
        this.arr = args.nextUint8Array();
        return { instance: this, offset: args.getOffset() };
    }
}
