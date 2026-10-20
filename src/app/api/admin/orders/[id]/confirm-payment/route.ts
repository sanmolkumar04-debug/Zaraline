import { api } from "@/lib/api";
import { HttpError, isAdmin, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { markPaid } from "@/lib/orders";

// Admin has checked the UPI app / bank statement and received the money for a submitted payment.
export const POST = api<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const u = await requireUser();
  if (!u.email || !isAdmin(u.email)) throw new HttpError(403, "Forbidden");
  const pay = await db.payment.findFirst({ where: { orderId: (await ctx.params).id, status: "CREATED", gatewayPaymentId: { not: null } }, orderBy: { createdAt: "desc" } });
  if (!pay?.gatewayPaymentId) throw new HttpError(400, "No submitted payment to confirm");
  await markPaid(pay.gatewayOrderId, pay.gatewayPaymentId);
  return { ok: true };
});
