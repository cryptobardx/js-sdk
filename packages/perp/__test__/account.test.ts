import { describe, expect, it } from "@jest/globals";
import { OrderSide } from "@orderly.network/types";
import * as account from "../src/account";

describe("account formula", () => {
  describe("maxQtyForIsolatedMargin", () => {
    it("should reserve fee buffer and safety factor for same-direction orders", () => {
      const maxQty = account.maxQtyForIsolatedMargin({
        symbol: "PERP_BTC_USDC",
        orderSide: OrderSide.BUY,
        currentOrderReferencePrice: 50000,
        availableBalance: 100,
        leverage: 10,
        baseIMR: 0.1,
        IMR_Factor: 0.0000001,
        markPrice: 50000,
        positionQty: 0,
        pendingLongOrders: [],
        pendingSellOrders: [],
        isoOrderFrozenLong: 0,
        isoOrderFrozenShort: 0,
        symbolMaxNotional: 10000000,
      });

      expect(maxQty).toBeCloseTo(0.019781312127236578, 12);
    });

    it("should subtract existing frozen margin in flip binary search", () => {
      const maxQty = account.maxQtyForIsolatedMargin({
        symbol: "PERP_BTC_USDC",
        orderSide: OrderSide.BUY,
        currentOrderReferencePrice: 100,
        availableBalance: 100,
        leverage: 10,
        baseIMR: 0.1,
        IMR_Factor: 0.0000001,
        markPrice: 100,
        positionQty: -1,
        pendingLongOrders: [{ referencePrice: 100, quantity: 2 }],
        pendingSellOrders: [],
        isoOrderFrozenLong: 20.12,
        isoOrderFrozenShort: 0,
        symbolMaxNotional: 1000,
        epsilon: 0.000001,
      });

      expect(maxQty).toBeCloseTo(9.940357852882704, 6);
    });
  });
});
