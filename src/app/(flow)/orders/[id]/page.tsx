import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LoginGate, RetryPayment } from "@/components/Account";
import { FlowHeader } from "@/components/Chrome";
import { Icon } from "@/components/Icon";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr } from "@/lib/format";
import { ORDER_STEPS, STATUS_LABEL } from "@/lib/orders";

export const metadata: Metadata = { title: "Order Details", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string; payment?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  const user = await currentUser();
  if (!user) return <><FlowHeader title="Login" backHref="/" /><LoginGate /></>;
  const { id } = await params;
  const sp = await searchParams;
  const o = await db.order.findFirst({
    where: { id, userId: user.id },
    include: { items: true, events: { orderBy: { createdAt: "asc" } }, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!o) notFound();
  const a = JSON.parse(o.address) as Record<string, string>;
  const unpaid = o.status === "PENDING_PAYMENT" || o.status === "PAYMENT_FAILED";
  const lastError = o.payments.find((p) => p.status === "FAILED" || p.status === "CANCELLED")?.error;
  const idx = (s: string) => (ORDER_STEPS as readonly string[]).indexOf(s);
  const reached = (s: string) => idx(o.status) >= idx(s);
  const eventAt = (s: string) => o.events.find((e) => e.status === s)?.createdAt;
  const methodLabel = o.paymentMethod === "COD" ? "Cash on Delivery (delivery charge paid online)" : o.paymentMethod === "PARTIAL" ? "Advance + COD" : "Online (UPI QR)";

  return (
    <>
      <FlowHeader title="Order Details" backHref="/orders" />
      <div className="container-x max-w-[900px] py-6 pb-24">
        {sp.placed && o.status === "CONFIRMED" && (
          <div className="mb-6 border border-[#bfe0c0] bg-offerbg p-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#10b91a] text-white"><Icon name="check" size={32} stroke={3} /></span>
            <h1 className="mt-4 text-[22px] font-bold">Order Placed Successfully!</h1>
            <p className="mt-1 text-[14px]">Thank you for shopping with Zari Lane. Your order <b>#{o.number}</b> has been confirmed.</p>
            <p className="mt-1 text-[13px] text-muted">
              {o.paymentMethod === "COD" ? `Delivery charge of ${inr(o.payNow)} paid online. Please keep ${inr(o.payOnDelivery)} ready at the time of delivery.`
                : o.paymentMethod === "PARTIAL" ? `${inr(o.payNow)} paid online. Pay ${inr(o.payOnDelivery)} on delivery.`
                : `Payment of ${inr(o.payNow)} received.`}
            </p>
          </div>
        )}
        {unpaid && (
          <div className="mb-6 border border-[#f5c2c0] bg-[#fdecea] p-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#d93025] text-white"><Icon name="close" size={30} stroke={3} /></span>
            <h1 className="mt-4 text-[22px] font-bold">{o.status === "PAYMENT_FAILED" ? "Payment Failed" : "Payment Pending"}</h1>
            <p className="mt-1 text-[14px]">
              {o.status === "PAYMENT_FAILED" ? (lastError ?? "Your payment could not be completed.") : "We have not received your payment yet. Pay with the UPI QR and upload your screenshot to confirm the order."}
            </p>
            <div className="mt-5 flex flex-col items-center gap-2">
              <RetryPayment orderId={o.id} />
              <Link href="/bag" className="text-[13px] font-semibold underline">Back to bag</Link>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2 border-b border-line pb-4">
          <div>
            <p className="text-[18px] font-bold">Order #{o.number}</p>
            <p className="text-[13px] text-muted">Placed on {o.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
          <span className="self-start rounded bg-soft px-3 py-1 text-[13px] font-bold">{STATUS_LABEL[o.status] ?? o.status}</span>
        </div>

        {!unpaid && o.status !== "CANCELLED" && (
          <section className="mt-6">
            <h2 className="text-[16px] font-bold">Track Order</h2>
            <ol className="mt-4 grid grid-cols-4">
              {ORDER_STEPS.map((s, i) => (
                <li key={s} className="relative flex flex-col items-center text-center">
                  {i > 0 && <span className={`absolute right-1/2 top-[11px] h-[2px] w-full ${reached(s) ? "bg-[#10b91a]" : "bg-[#ddd]"}`} />}
                  <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full ${reached(s) ? "bg-[#10b91a] text-white" : "border-2 border-[#ccc] bg-white"}`}>
                    {reached(s) && <Icon name="check" size={14} stroke={3} />}
                  </span>
                  <span className="mt-2 text-[12px] font-semibold">{STATUS_LABEL[s]}</span>
                  {eventAt(s) && <span className="text-[10px] text-muted">{eventAt(s)!.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                </li>
              ))}
            </ol>
            {o.status === "CONFIRMED" && <p className="mt-4 text-[13px] text-muted">Expected delivery in 3-7 days ({o.shippingMethod}).</p>}
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-[16px] font-bold">Items</h2>
          <ul className="mt-3 space-y-3">
            {o.items.map((i) => (
              <li key={i.id} className="flex gap-3 border border-line p-3">
                <img src={i.image} alt="" className="h-[100px] w-[74px] object-cover" />
                <div className="text-[13px]">
                  <p className="text-[14px]">{i.name}</p>
                  <p className="mt-1 text-muted">Size: {i.size} / Qty: {i.qty}</p>
                  <p className="mt-1 font-bold">{inr(i.price * i.qty)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="border border-line p-4 text-[13px] leading-5">
            <h2 className="mb-2 text-[15px] font-bold">Delivery Address</h2>
            <p className="font-semibold">{a.name}</p>
            <p>{a.line1}, {a.line2}{a.landmark ? `, ${a.landmark}` : ""}</p>
            <p>{a.city}, {a.state} - {a.pincode}</p>
            <p>Mobile: {a.phone}</p>
          </section>
          <section className="bg-[#f6f6f6] p-4 text-[13px]">
            <h2 className="mb-2 text-[15px] font-bold">Payment Summary</h2>
            <dl className="space-y-1.5">
              <div className="flex justify-between"><dt>Total MRP</dt><dd>{inr(o.mrpTotal)}</dd></div>
              <div className="flex justify-between"><dt>Discount on MRP</dt><dd className="text-offer">-{inr(o.mrpTotal - o.subtotal)}</dd></div>
              {o.offerDiscount > 0 && <div className="flex justify-between"><dt>Buy 2 Get 1 Free</dt><dd className="text-offer">-{inr(o.offerDiscount)}</dd></div>}
              {o.couponDiscount > 0 && <div className="flex justify-between"><dt>Coupon ({o.couponCode})</dt><dd className="text-offer">-{inr(o.couponDiscount)}</dd></div>}
              {o.paymentDiscount > 0 && <div className="flex justify-between"><dt>Payment discount</dt><dd className="text-offer">-{inr(o.paymentDiscount)}</dd></div>}
              <div className="flex justify-between"><dt>Delivery ({o.shippingMethod})</dt><dd>{o.shippingFee ? inr(o.shippingFee) : "FREE"}</dd></div>
              <div className="flex justify-between border-t border-[#ddd] pt-2 text-[15px] font-bold"><dt>Order Total</dt><dd>{inr(o.total)}</dd></div>
              <div className="flex justify-between"><dt>Payment method</dt><dd>{methodLabel}</dd></div>
              {o.payNow > 0 && <div className="flex justify-between"><dt>Paid online</dt><dd>{unpaid ? "—" : inr(o.payNow)}</dd></div>}
              {o.payOnDelivery > 0 && <div className="flex justify-between"><dt>Pay on delivery</dt><dd>{inr(o.payOnDelivery)}</dd></div>}
            </dl>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="btn-black inline-flex h-11 items-center px-8 text-[14px]">Continue Shopping</Link>
          <Link href="/orders" className="btn-outline inline-flex h-11 items-center px-8 text-[14px]">All Orders</Link>
        </div>
      </div>
    </>
  );
}
