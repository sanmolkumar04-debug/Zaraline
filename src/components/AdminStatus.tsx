 "use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUS_LABEL } from "@/lib/status";
import { http, useStore } from "./Store";

export function AdminStatus({ id, next }: { id: string; next: string[] }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { toast } = useStore();
  if (!next.length) return <span className="text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
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
