import { api } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cartView, getCart } from "@/lib/cart";
import type { PayMethod } from "@/lib/pricing";

export const GET = api(async (req) => {
  await requireUser();
  const sp = new URL(req.url).searchParams;
  const method = (["ONLINE", "COD", "PARTIAL"].includes(sp.get("method") ?? "") ? sp.get("method") : "ONLINE") as PayMethod;
  const shipping = await db.shippingMethod.findMany({ orderBy: { sort: "asc" } });
  const ship = shipping.find((s) => s.id === sp.get("shipping")) ?? shipping[0];
  return { cart: await cartView(await getCart(), method, ship.price), shipping, shippingId: ship.id, method };
});
