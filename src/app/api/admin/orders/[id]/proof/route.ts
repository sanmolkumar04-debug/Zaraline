import { isAdmin, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Serves the payment screenshot for an order to admins only.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await requireUser().catch(() => null);
  if (!u?.email || !isAdmin(u.email)) return new Response("Forbidden", { status: 403 });
  const pay = await db.payment.findFirst({ where: { orderId: (await ctx.params).id, proof: { not: null } }, orderBy: { createdAt: "desc" } });
  if (!pay?.proof) return new Response("No screenshot", { status: 404 });
  const bytes = Buffer.from(pay.proof.split(",")[1], "base64");
  return new Response(bytes, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store" } });
}
