import { test } from "node:test";
import assert from "node:assert/strict";
import { totals, couponError, type CouponRule } from "./pricing";

const SALE10: CouponRule = { code: "SALE10", kind: "PERCENT", value: 10, maxDiscount: 200, minAmount: 2449, minQty: 2, active: true };

test("online payment: 20% capped at 150 (reference: 1799 -> 1649)", () => {
  const t = totals([{ price: 1799, mrp: 4499, qty: 1 }], { method: "ONLINE" });
  assert.equal(t.total, 1649);
  assert.equal(t.payNow, 1649);
  assert.equal(t.saving, 2700);
});

test("coupon eligibility and cap", () => {
  assert.match(couponError(SALE10, 1799, 1)!, /Add 1 more item/);
  const t = totals([{ price: 1799, mrp: 4499, qty: 2 }], { coupon: SALE10, method: "COD", shippingFee: 149 });
  assert.equal(t.coupon, 200); // 10% of 3598 = 359 -> capped 200
  assert.equal(t.total, 3598 - 200 + 149);
  assert.equal(t.payNow, 0);
});

test("partial: 50 off, 149 advance", () => {
  const t = totals([{ price: 1299, mrp: 4599, qty: 1 }], { method: "PARTIAL" });
  assert.equal(t.total, 1249);
  assert.equal(t.payNow, 149);
  assert.equal(t.payOnDelivery, 1100);
});

test("buy 2 get 1 free: cheapest of every 3 is free, prices unchanged", () => {
  const l = (price: number, qty: number) => ({ price, mrp: price * 2, qty });
  assert.equal(totals([l(1000, 2)]).bogo, 0);
  const three = totals([l(1500, 1), l(1000, 1), l(1200, 1)]);
  assert.equal(three.bogo, 1000);
  assert.equal(three.subtotal, 3700); // list prices untouched
  assert.equal(three.total, 2700);
  assert.equal(totals([l(500, 2), l(900, 4)]).bogo, 1000); // 6 units: two cheapest (500 + 500) free
  assert.equal(totals([l(900, 5)]).bogo, 900); // 5 units: one free
});

test("buy 2 get 1 free stacks with coupon and online discount", () => {
  const t = totals([{ price: 1000, mrp: 2000, qty: 3 }], { coupon: SALE10, method: "ONLINE" });
  assert.equal(t.bogo, 1000);
  assert.equal(t.coupon, 200); // 10% of (3000 - 1000) = 200
  assert.equal(t.payment, 150); // 20% of 1800 = 360, capped 150
  assert.equal(t.total, 3000 - 1000 - 200 - 150);
  assert.equal(t.payNow, t.total);
});
