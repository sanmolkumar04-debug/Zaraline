 "use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUS_LABEL } from "@/lib/status";
import { http, useStore } from "./Store";

export function AdminStatus({ id, next, confirmPayment }: { id: string; next: string[]; confirmPayment?: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { toast } = useStore();
  if (!next.length && !confirmPayment) return <span className="text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {confirmPayment && (
        <button disabled={busy} onClick={async () => {
          setBusy(true);
          try { await http(`/api/admin/orders/${id}/confirm-payment`, { method: "POST" }); toast("Payment confirmed"); router.refresh(); }
          catch (e) { toast((e as Error).message, "err"); }
          setBusy(false);
        }} className="rounded border border-[#1aa34a] bg-[#1aa34a] px-2 py-1 text-[11px] font-bold text-white">Confirm payment</button>
      )}
      {next.map((s) => (
        <button key={s} disabled={busy} onClick={async () => {
          setBusy(true);
          try { await http(`/api/admin/orders/${id}`, { method: "PATCH", json: { status: s } }); toast(`Marked ${STATUS_LABEL[s] ?? s}`); router.refresh(); }
          catch (e) { toast((e as Error).message, "err"); }
          setBusy(false);
        }} className={`rounded border px-2 py-1 text-[11px] font-bold ${s === "CANCELLED" ? "border-sale text-sale" : "border-ink"}`}>{STATUS_LABEL[s] ?? s}</button>
      ))}
    </div>
  );
}
