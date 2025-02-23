import { u128, u256 } from 'as-bignum/assembly';

import {
  // Args,
  // u32ToBytes,
  // toBytes,
  // fromBytes,
  // Result,
  // Serializable,
  // stringToBytes,
  bytesToString,
  unwrapStaticArray,
  wrapStaticArray
} from '@massalabs/as-types';

import {
    Bytes32,
    Bytes4,
    AbiEncode,
    AbiEncodePacked, AbiEncodeWithSelector, bytes32ToU256
} from "../contracts/onChainFeeds/UmbrellaFeedsCommon";

import {EvmAddress} from "../contracts/utils";

// return bytes32 for "UmbrellaFeeds": 0x556d6272656c6c61466565647300000000000000000000000000000000000000
// return bytes32 for "a": 0x6100000000000000000000000000000000000000000000000000000000000000
// return bytes32 for "A": 0x4100000000000000000000000000000000000000000000000000000000000000
// return bytes16 for "A": 0x41000000000000000000000000000000
// return bytes4 for "C":  0x43000000
// return bytes1 for "B": 0x42

// encodePacked u16(65535), u8(42), u16(3): 0xffff2a0003
// encodePacked u16(65535), u8(42), u16(3), string("aAbc"): 0xffff2a000361416263

// keccack256(abi.encodePacked(v1, v2)), u16 v1 = 65536, uint8 v2 = 42 -> 0xdfda1898fa32f6f38210da86f4fc6ac68eca0982284e07cdf73a9d90a32807aa

describe("AbiEncodePacked", () => {
    it("test multi 1", () => {
        let val1: u16 = u16.MAX_VALUE; // 0xFF -> 255, 255
        let val2: u8 = 42; // 42
        let val3: u16 = 3; // 0 3
        let val4: u32 = 7; // 0 0 0 7
        let val5: string = "aAbc1"; // 0x6141626331 -> 97, 65, ....

        let _expected: Array<u8> = [255, 255, 42, 0, 3, 0, 0, 0, 7, 97, 65, 98, 99, 49];
        let expected: StaticArray<u8> = StaticArray.fromArray(_expected);

        let ap = new AbiEncodePacked();
        ap.add<u16>(val1);
        ap.add<u8>(val2);
        ap.add<u16>(val3);
        ap.add<u32>(val4);
        ap.add<string>(val5);

        let apSer = ap.serialize();

        // log<string>("expected:");
        // log<string>(expected.toString());
        // log<string>("apSer:");
        // log<string>(apSer.toString());
        // log<string>("===");
        // let buf = new Uint8Array(5);
        // buf[0] = 61; buf[1] = 41; buf[2] = 62; buf[3] = 63; buf[4] = 31;
        // log<string>(String.UTF8.decode(buf.buffer));
        // log<string>("===");
        // buf = new Uint8Array(5);
        // buf[0] = 97; buf[1] = 65; buf[2] = 98; buf[3] = 99; buf[4] = 49;
        // log<string>(String.UTF8.decode(buf.buffer));

        expect<i32>(apSer.length).toBe(expected.length);
        expect<StaticArray<u8>>(apSer).toStrictEqual(expected);
    });

    it("test multi 2", () => {
        let sa1 = new StaticArray<u8>(2);
        sa1.fill(87); // W, W -> 0x57, 0x57
        let sa2 = new StaticArray<u8>(2);
        sa2.fill(111); // o, o -> 0x6F, 0x6F
        let sa3: StaticArray<u8> = sa1.concat(sa2);

        // log<string>("sa3:");
        // log<string>(sa3.toString());

        let _expected: Array<u8> = [87, 87, 111, 111];
        let expected: StaticArray<u8> = StaticArray.fromArray(_expected);

        let ap = new AbiEncodePacked();
        ap.add<StaticArray<u8>>(sa1);
        ap.add<StaticArray<u8>>(sa2);
        let apSer = ap.serialize();

        expect<i32>(apSer.length).toBe(expected.length);
        expect<StaticArray<u8>>(apSer).toStrictEqual(expected);
    });
});

describe("Bytes32", () => {
    it("test dummy 1", () => {

        let sa1 = new StaticArray<u8>(2);
        sa1.fill(42);
        let sa2 = new StaticArray<u8>(2);
        sa2.fill(22);

        // log<string>("sa1:");
        // log<string>(sa1.toString());
        // log<string>("sa2:");
        // log<string>(sa2.toString());

        memory.copy(changetype<usize>(sa1), changetype<usize>(sa2), sa2.length);

        // log<string>("sa1:");
        // log<string>(sa1.toString());

    });

    throws("test with len > 32", () => {
        let sa1 = new StaticArray<u8>(33);
        sa1.fill(1);
        let mb32 = new Bytes32().add(sa1);
    });

    it("test with static array 1", () => {

        let sa1 = new StaticArray<u8>(2);
        sa1.fill(87); // W, W -> 0x57, 0x57
        let sa2 = new StaticArray<u8>(2);
        sa2.fill(111); // o, o -> 0x6F, 0x6F
        let mb32 = new Bytes32().add(sa1).add(sa2);

        // log<string>("sa1:");
        // log<string>(sa1.toString());
        // log<string>("sa2:");
        // log<string>(sa2.toString());

        let _expected: Array<u8> = [
            87, 87, 111, 111, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0
        ];
        let expected: StaticArray<u8> = StaticArray.fromArray(_expected);


        let mb32Ser = mb32.serialize();
        // log<string>("mb32Ser:");
        // log<string>(mb32Ser.toString());

        expect<i32>(expected.length).toBe(32);
        expect<i32>(mb32Ser.length).toBe(expected.length);
        expect<StaticArray<u8>>(mb32Ser).toStrictEqual(expected);
    });
    it("test with static array max len", () => {

        let sa1 = new StaticArray<u8>(32);
        sa1.fill(1);
        let mb32 = new Bytes32().add(sa1);
        let mb32Ser = mb32.serialize();

        let _expected: Array<u8> = [
            1, 1, 1, 1, 1, 1, 1, 1,
            1, 1, 1, 1, 1, 1, 1, 1,
            1, 1, 1, 1, 1, 1, 1, 1,
            1, 1, 1, 1, 1, 1, 1, 1
        ];
        let expected: StaticArray<u8> = StaticArray.fromArray(_expected);

        expect<i32>(expected.length).toBe(32);
        expect<i32>(mb32Ser.length).toBe(expected.length);
        expect<StaticArray<u8>>(mb32Ser).toStrictEqual(expected);
    });
    it("test with string 1", () => {

        // aA1: 97, 65, 49
        let mb32 = new Bytes32().add("aA1").add("bB2");

        // log<string>("sa1:");
        // log<string>(sa1.toString());
        // log<string>("sa2:");
        // log<string>(sa2.toString());

        let mb32Ser = mb32.serialize();
        // log<string>("mb32Ser string:");
        // log<string>(mb32Ser.toString());


        let _expected: Array<u8> = [
            97, 65, 49, 98, 66, 50, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0
        ];
        let expected: StaticArray<u8> = StaticArray.fromArray(_expected);

        expect<i32>(expected.length).toBe(32);
        expect<i32>(mb32Ser.length).toBe(expected.length);
        expect<StaticArray<u8>>(mb32Ser).toStrictEqual(expected);
    });
    it("Bytes32 + add unicode string", () => {
        let b32: Bytes32 = new Bytes32().add<string>("🌍");
        let b32Ser = b32.serialize();

        // from python 3: list(bytearray("🌍".encode("utf-8")))
        let _expected: Array<u8> = [
            240, 159, 140, 141, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
        ];
        let expected: StaticArray<u8> = StaticArray.fromArray(_expected);

        expect<i32>(expected.length).toBe(32);
        expect<i32>(b32Ser.length).toBe(expected.length);
        expect<StaticArray<u8>>(b32Ser).toStrictEqual(expected);
    });
});

describe("Bytes4", () => {

    it("Bytes4 + add string", () => {
        let b4: Bytes4 = new Bytes4().add<string>("1111");
        let b4Ser = b4.serialize();

        // from python 3: list(bytearray("1111".encode("utf-8")))
        let _expected: Array<u8> = [
            49, 49, 49, 49,
        ];
        let expected: StaticArray<u8> = StaticArray.fromArray(_expected);

        expect<i32>(expected.length).toBe(4);
        expect<i32>(b4Ser.length).toBe(expected.length);
        expect<StaticArray<u8>>(b4Ser).toStrictEqual(expected);
    });
    it("Bytes4 + add unicode string", () => {
        let b4: Bytes4 = new Bytes4().add<string>("🌍");
        let b4Ser = b4.serialize();

        // from python 3: list(bytearray("🌍".encode("utf-8")))
        let _expected: Array<u8> = [
            240, 159, 140, 141,
        ];
        let expected: StaticArray<u8> = StaticArray.fromArray(_expected);

        expect<i32>(expected.length).toBe(4);
        expect<i32>(b4Ser.length).toBe(expected.length);
        expect<StaticArray<u8>>(b4Ser).toStrictEqual(expected);
    });
    // FIXME: this fails but why?
    /*
    throws("test with len > 4", () => {
        let sa1 = new StaticArray<u8>(5);
        sa1.fill(1);
        let mb4 = new Bytes4().add(sa1);
    });
    */
});

describe("AbiEncodeWithSelector", () => {
    it("test empty", () => {
        let b4 = new Bytes4().add("1111");
        let aSel = new AbiEncodeWithSelector(b4);
        let aSelSer = aSel.serialize();

        let _expected: Array<u8> = [
            49, 49, 49, 49
        ];
        let expected: StaticArray<u8> = StaticArray.fromArray(_expected);

        expect<i32>(expected.length).toBe(4);
        expect<i32>(aSelSer.length).toBe(expected.length);
        expect<StaticArray<u8>>(aSelSer).toStrictEqual(expected);
    });
    it("test with u8 / u16", () => {
        let b4 = new Bytes4().add("1111");
        let aSel = new AbiEncodeWithSelector(b4).add<u16>(65283).add<u8>(42);
        // let aSel = new ArgsWithSelector(b4).add<u16>(65283);
        // let aSel = new ArgsWithSelector(b4).add<u8>(42);
        let aSelSer = aSel.serialize();

        let _expected: Array<u8> = [
            49, 49, 49, 49,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 3,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 42,
        ];
        let expected: StaticArray<u8> = StaticArray.fromArray(_expected);

        expect<i32>(expected.length).toBe(68); // 4 + 32 + 32
        expect<i32>(aSelSer.length).toBe(expected.length);
        expect<StaticArray<u8>>(aSelSer).toStrictEqual(expected);
    });
    it("test with Bytes32", () => {
        let b4 = new Bytes4().add("1111");
        let b32 = new Bytes32().add("AiuuuuuuuuuuuuuuuuuuuuuuuuuuuAiu");

        let aSel = new AbiEncodeWithSelector(b4).add(b32);
        let aSelSer = aSel.serialize();

        let _expected: Array<u8> = [
            49, 49, 49, 49, // 1111
            65, 105, 117, 117, // Aiuu
            117, 117, 117, 117,
            117, 117, 117, 117,
            117, 117, 117, 117,
            117, 117, 117, 117,
            117, 117, 117, 117,
            117, 117, 117, 117,
            117, 65, 105, 117, // uAiu
        ];
        let expected: StaticArray<u8> = StaticArray.fromArray(_expected);

        expect<i32>(expected.length).toBe(36); // 4 + 32
        expect<i32>(aSelSer.length).toBe(expected.length);
        expect<StaticArray<u8>>(aSelSer).toStrictEqual(expected);
    });
});

describe("AbiEncode", () => {
    it("test u8", () => {
        let v2: u8 = 42;
        let _expected: Array<u8> = [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 42,
        ];
        let encode = new AbiEncode().add(v2);
        let enc = encode.serialize();

        let expected: StaticArray<u8> = StaticArray.fromArray(_expected);

        expect<i32>(expected.length).toBe(32);
        expect<i32>(enc.length).toBe(expected.length);
        expect<StaticArray<u8>>(enc).toStrictEqual(expected);
    });
    it("test u16", () => {
        let v2: u16 = 65535;
        let _expected: Array<u8> = [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255,
        ];
        let encode = new AbiEncode().add(v2);
        let enc = encode.serialize();

        let expected: StaticArray<u8> = StaticArray.fromArray(_expected);

        expect<i32>(expected.length).toBe(32);
        expect<i32>(enc.length).toBe(expected.length);
        expect<StaticArray<u8>>(enc).toStrictEqual(expected);
    });
    it("test u256", () => {
        let v2: u256 = u256.Max;
        v2 = v2.postDec();
        let _expected: Array<u8> = [
            255, 255, 255, 255, 255, 255, 255, 255,
            255, 255, 255, 255, 255, 255, 255, 255,
            255, 255, 255, 255, 255, 255, 255, 255,
            255, 255, 255, 255, 255, 255, 255, 254
        ];
        let encode = new AbiEncode().add(v2);
        let enc = encode.serialize();

        let expected: StaticArray<u8> = StaticArray.fromArray(_expected);

        expect<i32>(expected.length).toBe(32);
        expect<i32>(enc.length).toBe(expected.length);
        expect<StaticArray<u8>>(enc).toStrictEqual(expected);
    });
    it("test str 1", () => {
        let v2 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab";
        assert(v2.length == 32);

        let _expected: Array<u8> = [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, // 32 (offset)
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, // 32 (str as bytes len)
            97, 97, 97, 97, 97, 97, 97, 97,
            97, 97, 97, 97, 97, 97, 97, 97,
            97, 97, 97, 97, 97, 97, 97, 97,
            97, 97, 97, 97, 97, 97, 97, 98, // aaaa...ab (bytes)
        ];

        let encode = new AbiEncode().add(v2);
        let enc = encode.serialize();

        let expected: StaticArray<u8> = StaticArray.fromArray(_expected);

        // log<string>("enc:");
        // log<i32>(enc.length);
        // log<string>(enc.toString());
        // log<string>("expected");
        // log<string>(expected.toString());
        // log<string>("=== 1");

        // 32 (magic num?) + 32 (v2 size) + 32 (v2 len)
        expect<i32>(expected.length).toBe(96);
        expect<i32>(enc.length).toBe(expected.length);
        expect<StaticArray<u8>>(enc).toStrictEqual(expected);
    });

    it("test str 2 (> 32)", () => {
        let v2 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabaaaaaaaaaaaaaaaaaaac";
        assert(v2.length == 52);

        let _expected: Array<u8> = [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, // 32 (offset)
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 52, // 32 (str as bytes len)
            97, 97, 97, 97, 97, 97, 97, 97,
            97, 97, 97, 97, 97, 97, 97, 97,
            97, 97, 97, 97, 97, 97, 97, 97,
            97, 97, 97, 97, 97, 97, 97, 98, // aaa...ab

            97, 97, 97, 97, 97, 97, 97, 97,
            97, 97, 97, 97, 97, 97, 97, 97,
            97, 97, 97, 99, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, // a...ac
        ];

        let encode = new AbiEncode().add(v2);
        let enc = encode.serialize();

        let expected: StaticArray<u8> = StaticArray.fromArray(_expected);

        // 32 (magic num?) + 32 (v2 size) + 32 (v2 len)
        expect<i32>(expected.length).toBe(128);
        expect<i32>(enc.length).toBe(expected.length);
        expect<StaticArray<u8>>(enc).toStrictEqual(expected);
    });
});

describe("EvmAddress tests", () => {

    it("test from u8[]", () => {

        // ~ Solidity
        // address addr1 = 0x0000000000000000000000000000000000000001;
        // uint160(addr1) -> 1
        // address addr2 = 0x0000000000000000000000000000000000000010;
        // uint160(addr2) -> 16
        // address a3 = 0x1000000000000000000000000000000000000000;
        // address a4 = 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE;
        // address a5 = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;

        let _evm_addr1: Array<u8> = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
        let _evm_addr2: Array<u8> = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0];
        let _evm_addr3: Array<u8> = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        let _evm_addr4: Array<u8> = [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 254];
        let _evm_addr5: Array<u8> = [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255];

        let evm_addr_value1 = new EvmAddress(StaticArray.fromArray(_evm_addr1)).toU256();
        let evm_addr_value2 = new EvmAddress(StaticArray.fromArray(_evm_addr2)).toU256();
        let evm_addr_value3 = new EvmAddress(StaticArray.fromArray(_evm_addr3)).toU256();
        let evm_addr_value4 = new EvmAddress(StaticArray.fromArray(_evm_addr4)).toU256();
        let evm_addr_value5 = new EvmAddress(StaticArray.fromArray(_evm_addr5)).toU256();

        assert(evm_addr_value2 > evm_addr_value1);
        assert(evm_addr_value3 > evm_addr_value2);
        assert(evm_addr_value4 > evm_addr_value3);
        assert(evm_addr_value5 > evm_addr_value4);
    });


    it("test fromHex", () => {
        let evm_addr = EvmAddress.fromHex("0000000000000000000000000000000000000001");
        let evm_addr_value1 = evm_addr.toU256();
        assert(evm_addr_value1 == u256.One);


        let evm_addr2 = EvmAddress.fromHex("97DBc63e611ad6135514dDCE138a8CDC8d1960eb");
        // from python3: print(list(bytearray.fromhex("97DBc63e611ad6135514dDCE138a8CDC8d1960eb")))
        let _expected: Array<u8> = [151, 219, 198, 62, 97, 26, 214, 19, 85, 20, 221, 206, 19, 138, 140, 220, 141, 25, 96, 235];
        let expected = StaticArray.fromArray(_expected);
        // serialize() add 32 bits length (4 bytes) so we need to slice it before checking ==
        expect(evm_addr2.serialize().slice<StaticArray<u8>>(4)).toStrictEqual(expected);
    });

    it("test fromHex 2", () => {
        let evm_addr = EvmAddress.fromHex("0x0000000000000000000000000000000000000001");
        let evm_addr_value1 = evm_addr.toU256();
        assert(evm_addr_value1 == u256.One);

        let evm_addr2 = EvmAddress.fromHex("97DBc63e611ad6135514dDCE138a8CDC8d1960eb");
        // from python3: print(list(bytearray.fromhex("97DBc63e611ad6135514dDCE138a8CDC8d1960eb")))
        let _expected: Array<u8> = [151, 219, 198, 62, 97, 26, 214, 19, 85, 20, 221, 206, 19, 138, 140, 220, 141, 25, 96, 235];
        let expected = StaticArray.fromArray(_expected);
        // serialize() add 32 bits length (4 bytes) so we need to slice it before checking ==
        expect(evm_addr2.serialize().slice<StaticArray<u8>>(4)).toStrictEqual(expected);
    });


    it("test fromHex 2", () => {
        let evm_addr_1 = EvmAddress.fromHex("0x0000000000000000000000000000000000000001");
        let evm_addr_2 = EvmAddress.fromHex("0x0000000000000000000000000000000000000001");
        let evm_addr_3 = EvmAddress.fromHex("97DBc63e611ad6135514dDCE138a8CDC8d1960eb");
        let evm_addr_4 = EvmAddress.fromHex("0x0000000000000000000000000000000000000000");
        let evm_addr_5 = EvmAddress.fromHex("0x3000000000000000000000000000000000000000");

        // expect(evm_addr_1).toBe(evm_addr_2);
        assert(evm_addr_1 == evm_addr_2);
        assert(evm_addr_1 != evm_addr_3);
        assert(evm_addr_1 != evm_addr_4);
        assert(evm_addr_1 != evm_addr_5);
    });
});

describe("bytes32 -> u256", () => {
    it("test 1", () => {

        let _val0_: Array<u8> = [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1
        ];
        let _val0 = StaticArray.fromArray(_val0_);
        let val0 = u256.fromUint8ArrayBE(wrapStaticArray(_val0));

        assert(val0 == u256.One);

        // Solidity:
        // 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0
        // python3:
        // l1 = bytearray.fromhex("7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0");
        // print(list(l1))
        let _val1_: Array<u8> = [127, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 93, 87, 110, 115, 87, 164, 80, 29, 223, 233, 47, 70, 104, 27, 32, 160];
        let _val1 = StaticArray.fromArray(_val1_);
        let val1 = bytes32ToU256(_val1);

        // +1
        let _val2_: Array<u8> = [127, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 93, 87, 110, 115, 87, 164, 80, 29, 223, 233, 47, 70, 104, 27, 32, 161];
        let _val2 = StaticArray.fromArray(_val2_);
        let val2 = bytes32ToU256(_val2);

        // + ...
        let _val3_: Array<u8> = [128, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 93, 87, 110, 115, 87, 164, 80, 29, 223, 233, 47, 70, 104, 27, 32, 160];
        let _val3 = StaticArray.fromArray(_val3_);
        let val3 = bytes32ToU256(_val3);

        assert(val1 > val0);
        assert(val2 > val1);
        assert(val3 > val2);
    });
});