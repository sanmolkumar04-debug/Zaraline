"use client";

import { useCallback, useState } from "react";
import { inr } from "@/lib/format";
import { Icon } from "./Icon";
import { http } from "./Store";

// `sessionId` carries which of the two UPI QR codes ("1" | "2") this attempt shows.
export type PayOrder = { orderId: string; number: string; payment: { gatewayOrderId: string; sessionId: string; amount: number }; prefill: { email: string; name: string } };
export type Outcome = { result: "submitted" | "cancelled"; orderId: string };

/** Shows the UPI QR and resolves once the customer submits their transaction id, or closes the dialog. */
export function usePayment() {
  const [open, setOpen] = useState<{ order: PayOrder; resolve: (o: Outcome) => void } | null>(null);

  const pay = useCallback((order: PayOrder) => new Promise<Outcome>((resolve) => setOpen({ order, resolve })), []);

  const finish = async (kind: "submitted" | "dismiss") => {
    if (!open) return;
    const { order, resolve } = open;
    setOpen(null);
    if (kind === "dismiss")
      await http("/api/payments/failed", { method: "POST", json: { order_id: order.payment.gatewayOrderId, reason: "CANCELLED", error: "Payment cancelled by user" } }).catch(() => {});
    resolve({ result: kind === "submitted" ? "submitted" : "cancelled", orderId: order.orderId });
  };

  const modal = open && <QrCheckout order={open.order} onFinish={finish} />;
  return { pay, modal };
}

function QrCheckout({ order, onFinish }: { order: PayOrder; onFinish: (k: "submitted" | "dismiss") => void }) {
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!/^\d{12}$/.test(utr)) return setErr("Enter the 12-digit UPI transaction ID");
    setBusy(true); setErr("");
    try {
      await http("/api/payments/submit", { method: "POST", json: { order_id: order.payment.gatewayOrderId, utr } });
      onFinish("submitted");
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
        <label htmlFor="utr" className="mt-4 block text-[13px] font-semibold">UPI transaction ID (12 digits)</label>
        <input id="utr" inputMode="numeric" maxLength={12} value={utr} onChange={(e) => { setUtr(e.target.value.replace(/\D/g, "")); setErr(""); }}
          placeholder="e.g. 412345678901" className="mt-1 h-11 w-full rounded border border-[#d5d5d5] px-3 text-[15px]" />
        {err && <p className="mt-1 text-[12px] text-sale" role="alert">{err}</p>}
        <button onClick={submit} disabled={busy} className="btn-black mt-4 h-12 w-full text-[15px] normal-case disabled:opacity-60">{busy ? "Submitting…" : "I have paid"}</button>
        <p className="mt-3 flex items-center gap-1 text-[11px] text-muted"><Icon name="lock" size={14} /> We confirm your payment manually, usually within a few hours.</p>
      </div>
    </div>
  );
}
