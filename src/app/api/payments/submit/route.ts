import { z } from "zod";
import { api, body } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { submitPaymentProof } from "@/lib/orders";

// UPI reference numbers (UTR) are 12 digits.
const Input = z.object({ order_id: z.string(), utr: z.string().trim().regex(/^\d{12}$/, "Enter the 12-digit UPI transaction ID") });

export const POST = api(async (req) => {
  const u = await requireUser();
  const r = Input.parse(await body(req));
  const order = await submitPaymentProof(r.order_id, u.id, r.utr);
  return { orderId: order.id };
});
