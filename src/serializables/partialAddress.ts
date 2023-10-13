import pkg from "bs58";
const { decode } = pkg;

export class PartialAddress {

    private data: Uint8Array = new Uint8Array(0);

    public constructor(data: Uint8Array) {
        if (data.length != 32) {
            throw new Error("Can only accept data length == 32");
        }
        this.data = data;
    }

    public static fromAddress(address: string): PartialAddress {

        let addrBytes = decode(address.slice(2));
        // console.log("addrBytes:", addrBytes, typeof addrBytes);
        if (addrBytes[0] != 0) {
            throw new Error("Unable to handle Address version != 0");
        }

        let addrBytesNoChecksum = addrBytes.slice(1, 33);

        if (addrBytesNoChecksum.length != 32) {
            throw new Error("Invalid Address format");
        }

        return new PartialAddress(addrBytesNoChecksum);
    }

    public getData(): Uint8Array {
        return this.data;
    }
}

/*
function test() {
    let addr1 = "AU12gdmcvpsvHPgVoiHzBiwke6M3fCg6TuMsifDh6Seu185r1FAen";
    let pAddr1 = PartialAddress.fromAddress(addr1);
    console.log("addr1 as hex:", Buffer.from(pAddr1.getData()).toString("hex").toUpperCase());
}

test();
*/