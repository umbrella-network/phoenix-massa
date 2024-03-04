import { u128 } from 'as-bignum/assembly';

import {PriceData} from "../contracts/onChainFeeds/UmbrellaFeedsCommon";

describe("priceData ser / der", () => {
    it("priceData regular serialize then deserialize", () => {
        let priceData = new PriceData(1, 25000, 61527, u128.from(1037));

        let ser = priceData.serialize();

        let priceData2: PriceData = new PriceData();
        priceData2.deserialize(ser).unwrap();

        expect(priceData).toStrictEqual(priceData2);

        let priceData3: PriceData = new PriceData();
        priceData3.try_deserialize(ser).unwrap();

        expect(priceData).toStrictEqual(priceData3);
        expect(priceData2).toStrictEqual(priceData3);
    });

    it("priceData try_deserialize invalid data", () => {

        // Check PriceData.try_deserialize will not throw on error

        let priceData = new PriceData(1, 25042, 60927, u128.from(1837));
        let ser = priceData.serialize();
        let priceData2: PriceData = new PriceData();
        // Note: slice serialized data to simulate an invalid buffer
        let invalid_ser = ser.slice<StaticArray<u8>>(1, 9);
        let res = priceData2.try_deserialize(invalid_ser);

        expect<bool>(res.isErr()).toBeTruthy();
        expect(priceData2).toStrictEqual(new PriceData());
    });

});
