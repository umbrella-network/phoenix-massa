import { u128 } from 'as-bignum/assembly';

import {PriceData} from "../contracts/onChainFeeds/UmbrellaFeedsCommon";

describe("priceData ser / der", () => {
    it("", () => {
        let priceData = new PriceData(1, 25000, 61527, u128.from(1037));

        let ser = priceData.serialize();

        let priceData2 = new PriceData();
        priceData2.deserialize(ser).unwrap();
    });
});
