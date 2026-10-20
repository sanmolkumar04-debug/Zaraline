import crypto from "node:crypto";
import { db } from "./db";
import { HttpError } from "./auth";
import { cartView, getCart } from "./cart";
import type { PayMethod } from "./pricing";

const orderNumber = () => "ZL" + Date.now().toString().slice(-8) + crypto.randomInt(10, 99);

export async function createCheckoutOrder(userId: string, input: { addressId: string; method: PayMethod; shippingId: string; idempotencyKey: string }) {
  // Same click / retry → same order.
  const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { payments: true } });
  if (existing) {
    if (existing.userId !== userId) throw new HttpError(409, "Duplicate request");
    return existing;
  }

  const cart = await getCart();
  if (!cart || cart.userId !== userId || !cart.items.length) throw new HttpError(400, "Your bag is empty");
  const address = await db.address.findFirst({ where: { id: input.addressId, userId } });
  if (!address) throw new HttpError(400, "Please select a delivery address");
  const ship = await db.shippingMethod.findUnique({ where: { id: input.shippingId } });
  if (!ship) throw new HttpError(400, "Please select a delivery method");

  for (const i of cart.items)
    if (i.variant.stock < i.qty)
      throw new HttpError(409, i.variant.stock <= 0 ? `${i.variant.product.name} (${i.variant.size}) is out of stock` : `Only ${i.variant.stock} left of ${i.variant.product.name} (${i.variant.size})`);

  const v = await cartView(cart, input.method, ship.price);
  if (v.couponError) throw new HttpError(400, v.couponError);
  const cartHash = crypto.createHash("sha256")
    .update(JSON.stringify([v.items.map((i) => [i.variantId, i.qty, i.price]), v.couponCode, input.method, ship.id, address.id]))
    .digest("hex");

  // Unpaid (pending / failed / cancelled) order for the exact same cart? Reuse it instead of creating a duplicate.
  const pending = await db.order.findFirst({ where: { userId, cartHash, status: { in: ["PENDING_PAYMENT", "PAYMENT_FAILED"] } }, include: { payments: true }, orderBy: { createdAt: "desc" } });
  if (pending) return pending;

  const snapshot = JSON.stringify({ name: address.name, phone: address.phone, email: address.email, line1: address.line1, line2: address.line2, landmark: address.landmark, city: address.city, state: address.state, pincode: address.pincode, type: address.type });
  const online = v.payNow > 0;

  const order = await db.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        number: orderNumber(), userId, status: online ? "PENDING_PAYMENT" : "CONFIRMED", paymentMethod: input.method,
        subtotal: v.subtotal, mrpTotal: v.mrpTotal, couponCode: v.couponCode, offerDiscount: v.bogo, couponDiscount: v.coupon, paymentDiscount: v.payment,
        shippingMethod: ship.name, shippingFee: v.shipping, total: v.total, payNow: v.payNow, payOnDelivery: v.payOnDelivery,
        address: snapshot, cartHash, idempotencyKey: input.idempotencyKey,
        items: { create: v.items.map((i) => ({ variantId: i.variantId, name: i.name, size: i.size, image: i.image, price: i.price, mrp: i.mrp, qty: i.qty })) },
        events: { create: { status: online ? "PENDING_PAYMENT" : "CONFIRMED", note: "Awaiting payment" } },
      },
    });
    if (!online) await confirmStockAndClearCart(tx, o.id, userId);
    return o;
  }).catch(async (e) => {
    // Concurrent request with the same idempotency key won the race: hand back its order.
    if ((e as { code?: string }).code === "P2002") {
      const dup = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (dup?.userId === userId) return dup;
    }
    throw e;
  });

  if (online) await newPaymentAttempt(order.id);
  return db.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
}

/** Opens a UPI QR payment attempt for a pending order. The two QR codes (sessionId "1" / "2") are used alternately. */
export async function newPaymentAttempt(orderId: string) {
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
  if (o.status !== "PENDING_PAYMENT" && o.status !== "PAYMENT_FAILED") throw new HttpError(409, "This order is already " + o.status.toLowerCase().replace("_", " "));
  const open = o.payments.find((p) => p.status === "CREATED");
  if (open) return open;
  const qr = ((await db.payment.count({ where: { provider: "upi_qr" } })) % 2) + 1;
  if (o.status === "PAYMENT_FAILED") await db.order.update({ where: { id: o.id }, data: { status: "PENDING_PAYMENT" } });
  return db.payment.create({ data: { orderId: o.id, provider: "upi_qr", amount: o.payNow * 100, status: "CREATED", gatewayOrderId: `${o.number}_${crypto.randomBytes(4).toString("hex")}`, sessionId: String(qr) } });
}

const MAX_PROOF_CHARS = 1_500_000;

/** Customer uploads a screenshot of the UPI payment; the order is approved right away and the screenshot is kept for admin review. */
export async function submitPaymentScreenshot(gatewayOrderId: string, userId: string, image: string) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!m || image.length > MAX_PROOF_CHARS || Buffer.from(m[1].slice(0, 8), "base64")[0] !== 0xff) throw new HttpError(400, "Please upload a valid screenshot image");
  const pay = await db.payment.findUnique({ where: { gatewayOrderId }, include: { order: true } });
  if (!pay || pay.order.userId !== userId) throw new HttpError(404, "Payment not found");
  if (pay.status !== "CREATED" || pay.order.status !== "PENDING_PAYMENT") throw new HttpError(409, "This payment can no longer be submitted");
  await db.payment.update({ where: { id: pay.id }, data: { proof: image } });
  return markPaid(gatewayOrderId, "ss_" + crypto.randomBytes(8).toString("hex"));
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function confirmStockAndClearCart(tx: Tx, orderId: string, userId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const it of items) {
    // ponytail: stock is decremented at confirmation, not reserved at checkout; a concurrent buyer can oversell the last unit.
    await tx.variant.update({ where: { id: it.variantId }, data: { stock: { decrement: it.qty } } });
  }
  const cart = await tx.cart.findFirst({ where: { userId } });
  if (cart) {
    await tx.cartItem.deleteMany({ where: { cartId: cart.id, variantId: { in: items.map((i) => i.variantId) } } });
    await tx.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
  }
}

/** Idempotent: verify endpoint and webhook may both call this for the same payment. */
export async function markPaid(gatewayOrderId: string, gatewayPaymentId: string, amountPaise?: number) {
  return db.$transaction(async (tx) => {
    const pay = await tx.payment.findUnique({ where: { gatewayOrderId }, include: { order: true } });
    if (!pay) throw new HttpError(404, "Payment not found");
    if (pay.status === "PAID") return pay.order;
    if (amountPaise !== undefined && amountPaise !== pay.amount) throw new HttpError(400, "Amount mismatch");
    await tx.payment.update({ where: { id: pay.id }, data: { status: "PAID", gatewayPaymentId, error: null } });
    // Close any other open attempts for this order.
    await tx.payment.updateMany({ where: { orderId: pay.orderId, status: "CREATED" }, data: { status: "CANCELLED" } });
    const note = pay.order.paymentMethod === "PARTIAL" ? `Advance of ₹${pay.order.payNow} paid online` : pay.order.paymentMethod === "COD" ? `Delivery charge of ₹${pay.order.payNow} paid online` : "Payment received";
    const order = await tx.order.update({
      where: { id: pay.orderId },
      data: { status: "CONFIRMED", events: { create: [{ status: "PAID", note }, { status: "CONFIRMED", note: "Order confirmed" }] } },
    });
    await confirmStockAndClearCart(tx, order.id, order.userId);
    return order;
  });
}

export async function markPaymentFailed(gatewayOrderId: string, status: "FAILED" | "CANCELLED", error: string, gatewayPaymentId?: string) {
  const pay = await db.payment.findUnique({ where: { gatewayOrderId }, include: { order: true } });
  if (!pay || pay.status === "PAID") return pay?.order ?? null;
  await db.payment.update({ where: { id: pay.id }, data: { status, error: error.slice(0, 300), gatewayPaymentId: gatewayPaymentId ?? pay.gatewayPaymentId } });
  if (pay.order.status === "PENDING_PAYMENT")
    return db.order.update({
      where: { id: pay.orderId },
      data: { status: "PAYMENT_FAILED", events: { create: { status: "PAYMENT_FAILED", note: status === "CANCELLED" ? "Payment cancelled" : `Payment failed: ${error.slice(0, 120)}` } } },
    });
  return pay.order;
}

export { ORDER_STEPS, STATUS_LABEL, NEXT_STATUS } from "./status";
