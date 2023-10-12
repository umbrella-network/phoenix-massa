import {Args, IDeserializedResult, ISerializable} from "@massalabs/massa-web3";

export class Validator implements ISerializable<Validator> {
    private id: string = "";
    private location: string = "";

    constructor(id: string = "", location: string = "") {
        this.id = id;
        this.location = location;
    }

    serialize(): Uint8Array {
        let args = new Args()
            .addString(this.id)
            .addString(this.location)
        return new Uint8Array(args.serialize());
    }
    deserialize(data: Uint8Array, offset: number): IDeserializedResult<Validator> {
        const args = new Args(data, offset);
        this.id = args.nextString();
        this.location = args.nextString();
        return { instance: this, offset: args.getOffset() };
    }
}
