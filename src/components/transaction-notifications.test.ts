import { describe, expect, it } from "vitest";
import { newlyArrivedPayments, type PaymentNotification } from "./transaction-notifications";

const payment = (orderId: string, seen = false): PaymentNotification => ({ orderId, hospitalName: "Merchant", amountPaise: 50000, paidAt: null, seen, category: "other" });

describe("payment notification arrival", () => {
  it("does not show historical payments as new on first load", () => {
    expect(newlyArrivedPayments([payment("old")], null)).toEqual([]);
  });
  it("queues each new unseen payment once in arrival order", () => {
    const feed = [payment("newest"), payment("middle"), payment("read", true), payment("old")];
    expect(newlyArrivedPayments(feed, new Set(["old"])).map((item) => item.orderId)).toEqual(["middle", "newest"]);
    expect(newlyArrivedPayments(feed, new Set(feed.map((item) => item.orderId)))).toEqual([]);
  });
});
