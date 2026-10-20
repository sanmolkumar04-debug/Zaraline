import { z } from "zod";
import { api, body } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { submitPaymentScreenshot } from "@/lib/orders";

const Input = z.object({ order_id: z.string(), image: z.string().max(1_600_000) });

export const POST = api(async (req) => {
  const u = await requireUser();
  const r = Input.parse(await body(req));
  const order = await submitPaymentScreenshot(r.order_id, u.id, r.image);
  return { orderId: order.id, status: order.status };
});
