import {Args, Result, Serializable, wrapStaticArray} from "@massalabs/as-types";
import {u256} from "as-bignum/assembly";
import {
    Address,
    balance,
    Context,
    generateEvent,
    getKeys,
    setBytecode,
    Storage,
    transferCoins
} from "@massalabs/massa-as-sdk";
import {decode as b58Decode} from "as-base58/assembly";

export class wBytes implements Serializable {
    protected data: StaticArray<u8>

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

    public getData(): StaticArray<u8> {
        return this.data;
    }
}

const EVM_ADDRESS_DATA_LEN = 20;
export class EvmAddress extends wBytes {

    constructor(data: StaticArray<u8> = new StaticArray<u8>(EVM_ADDRESS_DATA_LEN)) {
        super(data);
    }

    // In Solidity, evm address can be converted to uint160 (and then compared)
    // As we don't have u160 in AS, we convert here to 256
    public toU256(): u256 {
        // assert(this.data.length == 20, "Expect evm address length to be 20");
        let withPad = new StaticArray<u8>(12).concat(this.data);
        return u256.fromUint8ArrayBE(wrapStaticArray(withPad));
    }

    // Naive impl from: https://stackoverflow.com/questions/14603205/how-to-convert-hex-string-into-a-bytes-array-and-a-bytes-array-in-the-hex-strin
    public static fromHex(hex: string): EvmAddress {
        // address addr1 = 0x0000000000000000000000000000000000000001;
        assert(hex.length == 40 || hex.length == 42) // 40 == without 0x, 42 with
        let data = new StaticArray<u8>(EVM_ADDRESS_DATA_LEN);

        let _hex = hex;
        if (hex.length == 42) {
            _hex = hex.slice(2);
        }

        let j = 0;
        for (let i = 0; i < _hex.length; i += 2) {
            data[j] = U8.parseInt(_hex.substr(i, 2), 16);
            j++;
        }

        return new EvmAddress(data);
    }

    @inline @operator('==')
    static eq(a: EvmAddress, b: EvmAddress): bool {
        return memory.compare(changetype<usize>(a.data), changetype<usize>(b.data), EVM_ADDRESS_DATA_LEN) == 0;
    }

    @inline @operator('!=')
    static ne(a: EvmAddress, b: EvmAddress): bool {
        return !EvmAddress.eq(a, b);
    }
}

// emulate: Solidity selfdestruct
export function selfDestruct(transferToAddr: Address): void {

    // 1- empty the SC
    let emptySc = new StaticArray<u8>(0);
    setBytecode(emptySc);

    // 2- delete everything in Storage
    let keys = getKeys();
    for(let i=0; i<keys.length; i++) {
        Storage.del(keys[i]);
    }

    // 3- transfer back coins if any
    let scBalance = balance();
    // Balance will most likely be > 0 as we deleted some keys from the Storage
    // but if there is nothing in the Storage, no need to call transferCoins
    if (scBalance > 0) {
        transferCoins(transferToAddr, scBalance);
    }
}

export function publicKeyToU256(pk: string): u256 {
    // Remove 'P'
    let pkDecoded = b58Decode(pk.slice(1));
    // Remove version (0) and b58 checksum (at the end)
    let pkb32 = pkDecoded.slice(1, pkDecoded.length - 4);
    return u256.fromUint8ArrayLE(pkb32);
}

export function refund(initialBalance: u64): void {

    // generateEvent(`initialBalance: ${initialBalance}`);
    const newBalance: u64 = balance();
    // generateEvent(`newBalance: ${newBalance}`);
    // Notes:
    // initial balance > new balance: need to pay for some storage cost
    // initial balance < new balance: some storage has been freed and will be automatically reimbursed
    let balanceDelta: u64 = initialBalance > newBalance ? initialBalance - newBalance: 0;
    // generateEvent(`balanceDelta: ${balanceDelta}`);

    let transferredCoins = Context.transferredCoins();
    if (transferredCoins > 0) {
        // Only refund if caller has transferred too much coins (parameter coins of callSmartContract)
        let coinsToRefund = transferredCoins > balanceDelta ? transferredCoins - balanceDelta : 0;
        if (coinsToRefund > 0) {
            // generateEvent(`[refund] send back ${coinsToRefund} coins`);
            transferCoins(Context.caller(), coinsToRefund);
        }
    } else {
        // read only call - transferred coins is set to 0
        // to estimate gas cost & Storage cost
        // TEMP: need an event to retrieve gas cost
        let storageCost: u64 = balanceDelta;
        generateEvent(`Estimated storage cost: ${storageCost}`);
    }
}
