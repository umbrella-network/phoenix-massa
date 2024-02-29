import { u128 } from 'as-bignum/assembly';

import {PriceData} from "../contracts/onChainFeeds/UmbrellaFeedsCommon";

describe("priceData ser / der", () => {
    it("", () => {
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
});
