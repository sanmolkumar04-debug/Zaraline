import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LoginGate } from "@/components/Account";
import { AdminStatus } from "@/components/AdminStatus";
import { FlowHeader } from "@/components/Chrome";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr } from "@/lib/format";
import { NEXT_STATUS, STATUS_LABEL } from "@/lib/orders";

export const metadata: Metadata = { title: "Admin · Orders", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await currentUser();
  if (!user) return <><FlowHeader title="Admin Login" backHref="/" /><LoginGate /></>;
  if (!user.email || !isAdmin(user.email)) notFound();
  const { status } = await searchParams;
  const orders = await db.order.findMany({
    where: status ? { status } : undefined, orderBy: { createdAt: "desc" }, take: 200,
    include: { items: true, user: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const counts = await db.order.groupBy({ by: ["status"], _count: true });
  return (
    <>
      <FlowHeader title="Orders (Admin)" backHref="/" />
      <div className="container-x py-6 pb-24">
        <nav className="flex flex-wrap gap-2 text-[12px] font-semibold">
          <Link href="/admin" className={`rounded border px-3 py-1 ${!status ? "border-ink" : "border-line"}`}>All</Link>
          {counts.map((c) => (
            <Link key={c.status} href={`/admin?status=${c.status}`} className={`rounded border px-3 py-1 ${status === c.status ? "border-ink" : "border-line"}`}>{STATUS_LABEL[c.status] ?? c.status} ({c._count})</Link>
          ))}
        </nav>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead className="bg-soft text-[12px] uppercase"><tr>{["Order", "Date", "Customer", "Items", "Total", "Payment", "Status", "Update"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
            <tbody>
              {orders.map((o) => {
                const a = JSON.parse(o.address) as Record<string, string>;
                return (
                  <tr key={o.id} className="border-b border-line align-top">
                    <td className="p-3 font-bold">#{o.number}</td>
                    <td className="p-3">{o.createdAt.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="p-3">{a.name}<br /><span className="text-muted">{o.user.email} · +91 {a.phone} · {a.city}</span></td>
                    <td className="p-3">{o.items.map((i) => <div key={i.id}>{i.qty} × {i.name} ({i.size})</div>)}</td>
                    <td className="p-3 font-semibold">{inr(o.total)}</td>
                    <td className="p-3">{o.paymentMethod}<br /><span className="text-muted">{o.payments[0] ? `${o.payments[0].status} ${o.payments[0].gatewayPaymentId ? "UPI ref " + o.payments[0].gatewayPaymentId : "(no ref yet)"}` : "—"}</span></td>
                    <td className="p-3 font-semibold">{STATUS_LABEL[o.status] ?? o.status}</td>
                    <td className="p-3"><AdminStatus id={o.id} next={NEXT_STATUS[o.status] ?? []} confirmPayment={o.status === "PENDING_PAYMENT" && !!o.payments[0]?.gatewayPaymentId} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!orders.length && <p className="py-10 text-center text-muted">No orders.</p>}
        </div>
      </div>
    </>
  );
}
