"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { CartView } from "@/lib/cart";
import { inr } from "@/lib/format";
import { PARTIAL_ADVANCE, type PayMethod } from "@/lib/pricing";
import { AddressForm, type Address } from "./AddressForm";
import { Icon } from "./Icon";
import { LoginForm } from "./Login";
import { OffersDrawer, type CouponInfo } from "./Offers";
import { DotLoader } from "./ProductCard";
import { http, useStore } from "./Store";
import { usePayment, type PayOrder } from "./usePayment";

type Ship = { id: string; name: string; eta: string; price: number };
type Summary = { cart: CartView; shipping: Ship[]; shippingId: string; method: PayMethod };

const STEPS = ["Login", "Address", "Payment"] as const;
const ADDR_KEY = "zl_checkout_address";

function Stepper({ step }: { step: number }) {
  return (
    <div className="border-b border-line py-4">
      <ol className="mx-auto flex max-w-[400px] items-start justify-between px-4">
        {STEPS.map((s, i) => (
          <li key={s} className="relative flex flex-1 flex-col items-center">
            {i > 0 && <span className={`absolute right-1/2 top-[11px] h-px w-full ${i <= step ? "bg-ink" : "bg-[#d0d0d0]"}`} />}
            <span className={`relative z-10 flex h-[23px] w-[23px] items-center justify-center rounded-full border text-[11px] ${i < step ? "border-ink bg-ink text-white" : "border-ink bg-white"}`}>
              {i < step ? <Icon name="check" size={13} stroke={3} /> : i + 1}
            </span>
            <span className={`mt-1 text-[15px] ${i === step ? "font-bold" : "font-semibold"}`}>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BagSummary({ cart }: { cart: CartView }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between py-3 md:pointer-events-none">
        <span className="text-[15px] font-bold md:text-[21px]">Bag <span className="font-normal md:hidden">({cart.qty} item{cart.qty > 1 ? "s" : ""} · {inr(cart.total)})</span></span>
        <Icon name={open ? "up" : "down"} size={20} className="md:hidden" />
      </button>
      <ul className={`space-y-3 ${open ? "" : "max-md:hidden"}`}>
        {cart.items.map((i) => (
          <li key={i.variantId} className="flex gap-3 border border-line p-3">
            <img src={i.image} alt="" className="h-[128px] w-[94px] object-cover" />
            <div>
              <p className="text-[15px] leading-6">{i.name} ({i.size})</p>
              <p className="mt-2 text-[13px] text-muted">Size: {i.size} / Qty: {i.qty}</p>
              <p className="mt-2 text-[14px] font-bold">{inr(i.price * i.qty)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Checkout({ coupons }: { coupons: (CouponInfo & { minAmount: number; minQty: number })[] }) {
  const { user, ready, setCart, refresh, toast, setUser } = useStore();
  const router = useRouter();
  const sp = useSearchParams();
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [atPayment, setAtPayment] = useState(sp.get("step") === "payment");
  const [method, setMethod] = useState<PayMethod>("ONLINE");
  const [shippingId, setShippingId] = useState("standard");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [placing, setPlacing] = useState(false);
  const [notice, setNotice] = useState<{ kind: "err" | "info"; text: string } | null>(null);
  const [offers, setOffers] = useState(false);
  const { pay, modal } = usePayment();

  const onAuthError = useCallback((e: unknown) => {
    if ((e as { status?: number }).status === 401) { setUser(null); toast("Your session has expired. Please login again.", "err"); return true; }
    return false;
  }, [setUser, toast]);

  // Load addresses once logged in; restore selection after refresh.
  useEffect(() => {
    if (!user) return;
    http<{ addresses: Address[] }>("/api/addresses").then((r) => {
      setAddresses(r.addresses);
      const saved = sessionStorage.getItem(ADDR_KEY);
      const pick = r.addresses.find((a) => a.id === saved) ?? r.addresses.find((a) => a.isDefault) ?? r.addresses[0];
      setAddressId(pick?.id ?? null);
      if (!r.addresses.length) { setEditing("new"); setAtPayment(false); }
    }).catch(onAuthError);
  }, [user, onAuthError]);

  const loadSummary = useCallback(async () => {
    try {
      const s = await http<Summary>(`/api/checkout/summary?method=${method}&shipping=${shippingId}`);
      setSummary(s);
      setCart(s.cart);
    } catch (e) { if (!onAuthError(e)) toast((e as Error).message, "err"); }
  }, [method, shippingId, setCart, toast, onAuthError]);

  useEffect(() => { if (user) loadSummary(); }, [user, loadSummary]);

  useEffect(() => {
    const u = new URL(location.href);
    if (atPayment) u.searchParams.set("step", "payment"); else u.searchParams.delete("step");
    history.replaceState(null, "", u);
  }, [atPayment]);

  const step = !user ? 0 : atPayment && addressId ? 2 : 1;
  const cart = summary?.cart;
  const address = addresses?.find((a) => a.id === addressId);

  const chooseAddress = (id: string) => { setAddressId(id); sessionStorage.setItem(ADDR_KEY, id); };

  const applyCoupon = async (code: string) => {
    try { await http("/api/cart/coupon", { method: "POST", json: { code } }); await loadSummary(); toast("Offer applied on this order!"); return true; }
    catch (e) { toast((e as Error).message, "err"); return false; }
  };
  const removeCoupon = async () => { await http("/api/cart/coupon", { method: "DELETE" }).catch(() => {}); loadSummary(); };

  const place = async () => {
    if (!addressId || !cart || placing) return;
    setPlacing(true); setNotice(null);
    try {
      const r = await http<{ orderId: string; number: string; status: string; payment: PayOrder["payment"] | null; prefill: PayOrder["prefill"] }>("/api/checkout/order", {
        method: "POST", json: { addressId, method, shippingId, idempotencyKey: crypto.randomUUID() },
      });
      if (!r.payment) {
        await refresh();
        router.replace(`/orders/${r.orderId}?placed=1`);
        return;
      }
      const out = await pay({ orderId: r.orderId, number: r.number, payment: r.payment, prefill: r.prefill });
      if (out.result === "submitted") { await refresh(); router.replace(`/orders/${out.orderId}?submitted=1`); return; }
      setNotice({ kind: "info", text: "Payment cancelled. Your bag is saved — you can try again whenever you're ready." });
      setPlacing(false);
    } catch (e) {
      if (!onAuthError(e)) setNotice({ kind: "err", text: (e as Error).message });
      await loadSummary();
      setPlacing(false);
    }
  };

  if (!ready) return <DotLoader />;

  if (user && cart && !cart.items.length && !placing)
    return (
      <div className="py-20 text-center">
        <Icon name="bag" size={64} className="mx-auto text-[#cfcfcf]" />
        <p className="mt-4 text-[18px] font-semibold">Your bag is empty</p>
        <button onClick={() => router.push("/")} className="btn-black mt-6 h-12 px-10 text-[15px]">Continue Shopping</button>
      </div>
    );

  const eligible = coupons.map((c) => ({ ...c, eligible: !!cart && cart.subtotal >= c.minAmount && cart.qty >= c.minQty }));
  const payLabel = !cart ? "" : method === "COD" ? `Place Order · ${inr(cart.total)}` : `Pay ${inr(cart.payNow)}`;

  return (
    <>
      <Stepper step={step} />
      <div className="container-x pb-32 pt-4 md:flex md:justify-between md:gap-10 md:pb-16 md:pt-8">
        <div className="md:w-[490px]">{cart ? <BagSummary cart={cart} /> : user ? <DotLoader /> : <GuestBag />}</div>

        <div className="mt-4 md:mt-3 md:w-[490px]">
          {step === 0 && <LoginForm />}

          {step === 1 && (
            addresses === null ? <DotLoader /> : editing ? (
              <>
                <h2 className="mb-4 text-[18px] font-bold">{editing === "new" ? "Add New Address" : "Edit Address"}</h2>
                <AddressForm
                  initial={editing === "new" ? undefined : editing}
                  defaultEmail={user?.email}
                  onCancel={addresses.length ? () => setEditing(null) : undefined}
                  onSaved={(a) => {
                    setAddresses((xs) => [a, ...(xs ?? []).filter((x) => x.id !== a.id)].map((x) => (a.isDefault && x.id !== a.id ? { ...x, isDefault: false } : x)));
                    chooseAddress(a.id); setEditing(null); setAtPayment(true);
                  }}
                />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between"><h2 className="text-[18px] font-bold">Select Delivery Address</h2><button onClick={() => setEditing("new")} className="text-[13px] font-bold underline">+ Add New</button></div>
                <ul className="mt-4 space-y-3">
                  {addresses.map((a) => (
                    <li key={a.id}>
                      <label className={`flex cursor-pointer gap-3 border p-4 ${a.id === addressId ? "border-ink" : "border-line"}`}>
                        <input type="radio" name="address" checked={a.id === addressId} onChange={() => chooseAddress(a.id)} className="mt-1 accent-black" />
                        <span className="flex-1 text-[13px] leading-5">
                          <b className="text-[14px]">{a.name}</b> <span className="ml-1 rounded bg-soft px-1.5 py-0.5 text-[10px] font-bold">{a.type}</span>{a.isDefault && <span className="ml-1 text-[10px] font-bold text-offer">DEFAULT</span>}
                          <span className="mt-1 block">{a.line1}, {a.line2}{a.landmark ? `, ${a.landmark}` : ""}</span>
                          <span className="block">{a.city}, {a.state} - {a.pincode}</span>
                          <span className="block">Mobile: {a.phone}</span>
                          <span className="mt-2 flex gap-4">
                            <button type="button" onClick={(e) => { e.preventDefault(); setEditing(a); }} className="text-[12px] font-bold underline">Edit</button>
                            <button type="button" onClick={async (e) => {
                              e.preventDefault();
                              try {
                                await http(`/api/addresses/${a.id}`, { method: "DELETE" });
                                const rest = addresses.filter((x) => x.id !== a.id);
                                setAddresses(rest);
                                if (addressId === a.id) setAddressId(rest[0]?.id ?? null);
                                if (!rest.length) setEditing("new");
                              } catch (err) { toast((err as Error).message, "err"); }
                            }} className="text-[12px] font-bold text-sale underline">Delete</button>
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <button disabled={!addressId} onClick={() => setAtPayment(true)} className="btn-black mt-5 h-[45px] w-full text-[15px] normal-case">Deliver Here</button>
              </>
            )
          )}

          {step === 2 && address && cart && summary && (
            <div className="space-y-5">
              <section className="border border-line p-4 text-[13px] leading-5">
                <div className="flex justify-between"><b className="text-[14px]">Deliver to: {address.name}</b><button onClick={() => setAtPayment(false)} className="text-[12px] font-bold underline">Change</button></div>
                <p className="mt-1">{address.line1}, {address.line2}, {address.city}, {address.state} - {address.pincode}</p>
                <p>Mobile: {address.phone}</p>
              </section>

              <section>
                <h3 className="mb-2 text-[15px] font-bold">Delivery Method</h3>
                <div className="space-y-2">
                  {summary.shipping.map((s) => (
                    <label key={s.id} className={`flex cursor-pointer items-center gap-3 border p-3 ${shippingId === s.id ? "border-ink" : "border-line"}`}>
                      <input type="radio" name="ship" checked={shippingId === s.id} onChange={() => setShippingId(s.id)} className="accent-black" />
                      <span className="flex-1 text-[13px]"><b className="block text-[14px]">{s.name}</b>{s.eta}</span>
                      <b className="text-[14px]">{s.price ? inr(s.price) : <span className="text-offer">FREE</span>}</b>
                    </label>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-[15px] font-bold">Payment Method</h3>
                <div className="space-y-2">
                  {([
                    ["ONLINE", "Pay Online", "Pay by scanning a UPI QR code", "Extra 20% off"],
                    ["PARTIAL", `Pay ${inr(PARTIAL_ADVANCE)} now, rest on delivery`, "Pay a small advance online, balance in cash", "Extra ₹50 off"],
                    ["COD", "Cash on Delivery", "Pay in cash when your order arrives", null],
                  ] as const).map(([m, t, d, badge]) => (
                    <label key={m} className={`flex cursor-pointer items-center gap-3 border p-3 ${method === m ? "border-ink" : "border-line"}`}>
                      <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} className="accent-black" />
                      <span className="flex-1 text-[12px] text-[#555]"><b className="block text-[14px] text-ink">{t}</b>{d}</span>
                      {badge && <span className="rounded bg-offerbg px-2 py-1 text-[11px] font-bold text-offer">{badge}</span>}
                    </label>
                  ))}
                </div>
              </section>

              <section className="bg-[#f6f6f6] p-4 text-[14px]">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[15px] font-bold">Price Details ({cart.qty} item{cart.qty > 1 ? "s" : ""})</h3>
                  <button onClick={() => setOffers(true)} className="flex items-center gap-1 text-[12px] font-bold text-offer"><Icon name="tag" size={14} />{cart.couponCode ? "Change coupon" : "Apply coupon"}</button>
                </div>
                <dl className="space-y-2">
                  <div className="flex justify-between"><dt>Total MRP</dt><dd>{inr(cart.mrpTotal)}</dd></div>
                  <div className="flex justify-between"><dt>Discount on MRP</dt><dd className="text-offer">-{inr(cart.saving)}</dd></div>
                  {cart.bogo > 0 && <div className="flex justify-between"><dt>Buy 2 Get 1 Free</dt><dd className="text-offer">-{inr(cart.bogo)}</dd></div>}
                  {cart.couponCode && (
                    <div className="flex justify-between"><dt>Coupon ({cart.couponCode}) <button onClick={removeCoupon} className="ml-1 text-[11px] underline">Remove</button></dt><dd className={cart.couponError ? "text-sale" : "text-offer"}>{cart.couponError ? "Not applicable" : `-${inr(cart.coupon)}`}</dd></div>
                  )}
                  {cart.payment > 0 && <div className="flex justify-between"><dt>{method === "ONLINE" ? "Online payment discount" : "Advance payment discount"}</dt><dd className="text-offer">-{inr(cart.payment)}</dd></div>}
                  <div className="flex justify-between"><dt>Delivery Fee</dt><dd>{cart.shipping ? inr(cart.shipping) : <span className="text-offer">FREE</span>}</dd></div>
                  <div className="flex justify-between border-t border-[#ddd] pt-3 text-[16px] font-bold"><dt>Order Total</dt><dd>{inr(cart.total)}</dd></div>
                  {method === "PARTIAL" && <>
                    <div className="flex justify-between text-[13px]"><dt>Pay now (online)</dt><dd className="font-bold">{inr(cart.payNow)}</dd></div>
                    <div className="flex justify-between text-[13px]"><dt>Pay on delivery</dt><dd className="font-bold">{inr(cart.payOnDelivery)}</dd></div>
                  </>}
                </dl>
                {cart.couponError && <p className="mt-2 text-[12px] text-sale">{cart.couponError}</p>}
              </section>

              {notice && <p role="alert" className={`border p-3 text-[13px] ${notice.kind === "err" ? "border-sale bg-[#fdecea] text-sale" : "border-[#f0c36d] bg-[#fff8e5]"}`}>{notice.text}</p>}

              <div className="max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:border-t max-md:border-line max-md:bg-white max-md:p-3">
                <button onClick={place} disabled={placing || !!cart.couponError || cart.items.some((i) => i.qty > i.stock)} className="btn-black h-[48px] w-full text-[16px] normal-case">
                  {placing ? "Processing…" : payLabel}
                </button>
                <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted"><Icon name="lock" size={12} /> 100% secure payments</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {modal}
      <OffersDrawer open={offers} onClose={() => setOffers(false)} coupons={eligible} withInput onApply={applyCoupon} applied={cart?.couponError ? null : cart?.couponCode} />
    </>
  );
}

function GuestBag() {
  const { cart } = useStore();
  return cart ? <BagSummary cart={cart} /> : null;
}
