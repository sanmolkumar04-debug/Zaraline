"use client";

import { useCallback, useState } from "react";
import { inr } from "@/lib/format";
import { Icon } from "./Icon";
import { http } from "./Store";

// `sessionId` carries which of the two UPI QR codes ("1" | "2") this attempt shows.
export type PayOrder = { orderId: string; number: string; payment: { gatewayOrderId: string; sessionId: string; amount: number }; prefill: { email: string; name: string } };
export type Outcome = { result: "paid" | "cancelled"; orderId: string };

/** Shows the UPI QR and resolves once the customer uploads a payment screenshot (the order is then approved), or closes the dialog. */
export function usePayment() {
  const [open, setOpen] = useState<{ order: PayOrder; resolve: (o: Outcome) => void } | null>(null);

  const pay = useCallback((order: PayOrder) => new Promise<Outcome>((resolve) => setOpen({ order, resolve })), []);

  const finish = async (kind: "paid" | "dismiss") => {
    if (!open) return;
    const { order, resolve } = open;
    setOpen(null);
    if (kind === "dismiss")
      await http("/api/payments/failed", { method: "POST", json: { order_id: order.payment.gatewayOrderId, reason: "CANCELLED", error: "Payment cancelled by user" } }).catch(() => {});
    resolve({ result: kind === "paid" ? "paid" : "cancelled", orderId: order.orderId });
  };

  const modal = open && <QrCheckout order={open.order} onFinish={finish} />;
  return { pay, modal };
}

/** Shrinks a screenshot to a ~1000px JPEG so it stays small enough to upload and store. */
function toJpeg(file: File) {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Please choose an image file")); };
    img.src = url;
  });
}

function QrCheckout({ order, onFinish }: { order: PayOrder; onFinish: (k: "paid" | "dismiss") => void }) {
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pick = async (f?: File) => {
    if (!f) return;
    setErr("");
    try { setShot(await toJpeg(f)); } catch (e) { setShot(null); setErr((e as Error).message); }
  };
  const submit = async () => {
    if (!shot) return setErr("Please upload your payment screenshot");
    setBusy(true); setErr("");
    try {
      await http("/api/payments/submit", { method: "POST", json: { order_id: order.payment.gatewayOrderId, image: shot } });
      onFinish("paid");
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/60 p-3 text-left" role="dialog" aria-modal="true" aria-label="Payment">
      <div className="anim-fade relative my-auto w-full max-w-[420px] rounded-lg bg-white p-6 shadow-2xl">
        <button aria-label="Close payment" onClick={() => onFinish("dismiss")} className="absolute right-3 top-3 p-1 text-[#555]"><Icon name="close" /></button>
        <p className="text-[12px] text-muted">Order #{order.number}</p>
        <p className="text-[15px] font-semibold">Pay using any UPI app</p>
        <p className="mt-1 text-[28px] font-bold">{inr(order.payment.amount / 100)}</p>
        <p className="text-[12px] text-sale">Enter exactly this amount when you pay.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/pay/qr${order.payment.sessionId === "2" ? 2 : 1}.jpeg`} alt="UPI payment QR code" className="mx-auto mt-4 h-[240px] w-[240px] object-contain" />
        <p className="mt-2 text-center text-[12px] text-muted">Scan with Google Pay, PhonePe, Paytm or any UPI app.</p>
        <label htmlFor="shot" className="mt-4 block text-[13px] font-semibold">Upload payment screenshot</label>
        <input id="shot" type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} className="mt-1 block w-full text-[13px]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {shot && <img src={shot} alt="Your payment screenshot" className="mt-3 max-h-[160px] rounded border border-line" />}
        {err && <p className="mt-1 text-[12px] text-sale" role="alert">{err}</p>}
        <button onClick={submit} disabled={busy || !shot} className="btn-black mt-4 h-12 w-full text-[15px] normal-case disabled:opacity-60">{busy ? "Submitting…" : "Submit & confirm order"}</button>
        <p className="mt-3 flex items-center gap-1 text-[11px] text-muted"><Icon name="lock" size={14} /> Your order is confirmed as soon as the screenshot is uploaded.</p>
      </div>
    </div>
  );
}
