"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AddressForm, type Address } from "./AddressForm";
import { Icon } from "./Icon";
import { LoginForm } from "./Login";
import { http, useStore } from "./Store";
import type { PayOrder } from "./usePayment";
import { usePayment } from "./usePayment";

export function LoginGate() {
  const router = useRouter();
  return (
    <div className="md:flex md:min-h-[calc(100vh-100px)]">
      <div className="hidden flex-1 items-end justify-center bg-black pb-10 md:flex">
        <img src="/logo.svg" alt="" className="h-16 w-16 rounded-xl bg-white p-1" />
      </div>
      <div className="flex flex-1 justify-center px-4 pt-10 md:pt-16">
        <div className="w-full max-w-[540px]"><LoginForm label="Enter Email*" onDone={() => router.refresh()} /></div>
      </div>
    </div>
  );
}

export function AccountNav({ email }: { email: string }) {
  const path = usePathname();
  const router = useRouter();
  const { refresh, toast } = useStore();
  const logout = async () => {
    await http("/api/auth/logout", { method: "POST" }).catch(() => {});
    sessionStorage.clear();
    await refresh();
    toast("Logged out");
    router.push("/");
    router.refresh();
  };
  const tab = (href: string, label: string) => (
    <Link href={href} className={`border-b-2 pb-2 text-[14px] font-semibold ${path === href ? "border-ink" : "border-transparent text-muted"}`}>{label}</Link>
  );
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line">
      <div className="flex gap-6">{tab("/orders", "My Orders")}{tab("/addresses", "Saved Addresses")}</div>
      <div className="flex items-center gap-4 pb-2 text-[13px]"><span className="text-muted">{email}</span><button onClick={logout} className="font-semibold underline">Logout</button></div>
    </div>
  );
}

export function AddressBook({ initial, email }: { initial: Address[]; email: string }) {
  const [list, setList] = useState(initial);
  const [editing, setEditing] = useState<Address | "new" | null>(initial.length ? null : "new");
  const { toast } = useStore();
  if (editing)
    return (
      <div className="mt-6 max-w-[560px]">
        <h2 className="mb-4 text-[18px] font-bold">{editing === "new" ? "Add New Address" : "Edit Address"}</h2>
        <AddressForm initial={editing === "new" ? undefined : editing} defaultEmail={email} onCancel={list.length ? () => setEditing(null) : undefined}
          onSaved={(a) => { setList((xs) => [a, ...xs.filter((x) => x.id !== a.id)].map((x) => (a.isDefault && x.id !== a.id ? { ...x, isDefault: false } : x))); setEditing(null); toast("Address saved"); }} />
      </div>
    );
  return (
    <div className="mt-6">
      <button onClick={() => setEditing("new")} className="btn-outline h-11 px-5 text-[14px]">+ Add New Address</button>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {list.map((a) => (
          <li key={a.id} className="border border-line p-4 text-[13px] leading-5">
            <b className="text-[14px]">{a.name}</b> <span className="ml-1 rounded bg-soft px-1.5 py-0.5 text-[10px] font-bold">{a.type}</span>{a.isDefault && <span className="ml-1 text-[10px] font-bold text-offer">DEFAULT</span>}
            <p className="mt-1">{a.line1}, {a.line2}{a.landmark ? `, ${a.landmark}` : ""}</p>
            <p>{a.city}, {a.state} - {a.pincode}</p>
            <p>Mobile: {a.phone}</p>
            <div className="mt-3 flex gap-4">
              <button onClick={() => setEditing(a)} className="flex items-center gap-1 text-[12px] font-bold underline"><Icon name="edit" size={14} />Edit</button>
              <button onClick={async () => {
                try { await http(`/api/addresses/${a.id}`, { method: "DELETE" }); setList((xs) => xs.filter((x) => x.id !== a.id)); toast("Address deleted"); }
                catch (e) { toast((e as Error).message, "err"); }
              }} className="flex items-center gap-1 text-[12px] font-bold text-sale underline"><Icon name="trash" size={14} />Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RetryPayment({ orderId }: { orderId: string }) {
  const { pay, modal } = usePayment();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();
  const { refresh } = useStore();
  const retry = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await http<PayOrder>("/api/payments/retry", { method: "POST", json: { orderId } });
      const out = await pay(r);
      if (out.result === "paid") { await refresh(); location.replace(`/orders/${orderId}?placed=1`); return; }
      setMsg("Payment cancelled.");
      router.refresh();
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };
  return (
    <>
      <button onClick={retry} disabled={busy} className="btn-black h-12 w-full max-w-[320px] text-[15px] normal-case">{busy ? "Processing…" : "Pay Now"}</button>
      {msg && <p className="mt-2 text-[13px] text-sale" role="alert">{msg}</p>}
      {modal}
    </>
  );
}
