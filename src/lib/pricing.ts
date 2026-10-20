// Pure pricing rules shared by bag, checkout and order creation. Server is the source of truth.

export type PayMethod = "ONLINE" | "COD" | "PARTIAL";
export type Line = { price: number; mrp: number; qty: number };
export type CouponRule = { code: string; kind: string; value: number; maxDiscount: number | null; minAmount: number; minQty: number; active: boolean };

export const ONLINE_OFF_PCT = 20;
export const ONLINE_OFF_MAX = 150;
export const PARTIAL_OFF = 50;
export const PARTIAL_ADVANCE = 149;
export const COD_DELIVERY_FEE = 199; // Cash on Delivery orders pay this delivery charge online, up front.

export function onlineDiscount(amount: number) {
  return Math.min(Math.floor((amount * ONLINE_OFF_PCT) / 100), ONLINE_OFF_MAX);
}

export function paymentDiscount(method: PayMethod, amount: number) {
  if (method === "ONLINE") return onlineDiscount(amount);
  if (method === "PARTIAL") return Math.min(PARTIAL_OFF, amount);
  return 0;
}

/** Returns an error message if the coupon can't be applied, else null. */
export function couponError(c: CouponRule | null, subtotal: number, qty: number): string | null {
  if (!c || !c.active) return "Invalid coupon code";
  if (qty < c.minQty) return `Add ${c.minQty - qty} more item${c.minQty - qty > 1 ? "s" : ""} to use ${c.code}`;
  if (subtotal < c.minAmount) return `Shop for ₹${(c.minAmount - subtotal).toLocaleString("en-IN")} more to use ${c.code}`;
  return null;
}

/** `base` is the amount the discount applies to (subtotal after the free item); eligibility is judged on the full subtotal. */
export function couponDiscount(c: CouponRule | null, subtotal: number, qty: number, base = subtotal) {
  if (!c || couponError(c, subtotal, qty)) return 0;
  const raw = c.kind === "PERCENT" ? Math.floor((base * c.value) / 100) : c.value;
  return Math.min(raw, c.maxDiscount ?? raw, base);
}

export const BOGO_GROUP = 3; // Buy 2 Get 1 Free: in every group of 3 units, the cheapest one is free.

/** Value of the free units: the cheapest floor(qty/3) units across the whole bag. Prices themselves never change. */
export function bogoDiscount(lines: Line[]) {
  const units = lines.flatMap((l) => Array<number>(l.qty).fill(l.price)).sort((a, b) => a - b);
  return units.slice(0, Math.floor(units.length / BOGO_GROUP)).reduce((s, p) => s + p, 0);
}

export function totals(lines: Line[], opts: { coupon?: CouponRule | null; method?: PayMethod | null; shippingFee?: number } = {}) {
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const mrpTotal = lines.reduce((s, l) => s + l.mrp * l.qty, 0);
  const qty = lines.reduce((s, l) => s + l.qty, 0);
  const bogo = bogoDiscount(lines);
  const coupon = couponDiscount(opts.coupon ?? null, subtotal, qty, subtotal - bogo);
  const payment = opts.method ? paymentDiscount(opts.method, subtotal - bogo - coupon) : 0;
  const shipping = (opts.shippingFee ?? 0) + (opts.method === "COD" ? COD_DELIVERY_FEE : 0);
  const total = subtotal - bogo - coupon - payment + shipping;
  const payNow = opts.method === "ONLINE" ? total : opts.method === "PARTIAL" ? Math.min(PARTIAL_ADVANCE, total) : opts.method === "COD" ? Math.min(COD_DELIVERY_FEE, total) : 0;
  return { subtotal, mrpTotal, qty, saving: mrpTotal - subtotal, bogo, coupon, payment, shipping, total, payNow, payOnDelivery: total - payNow };
}
