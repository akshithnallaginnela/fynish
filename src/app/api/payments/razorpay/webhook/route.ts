import { z } from "zod";
import { db } from "@/lib/db";
import { verifyWebhookSignature, RazorpayError } from "@/lib/razorpay";

const EventBody = z.object({
  event: z.string(),
  payload: z.object({ payment: z.object({ entity: z.object({
    id: z.string(), order_id: z.string().nullable(), amount: z.number().int(), status: z.string(), method: z.string().optional(), created_at: z.number().optional(),
  }) }) }),
});

export async function POST(request: Request) {
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  let raw: string;
  try { raw = await request.text(); } catch { return Response.json({ error: "invalid_body" }, { status: 400 }); }
  if (raw.length > 1_000_000) return Response.json({ error: "body_too_large" }, { status: 413 });
  try {
    if (!verifyWebhookSignature(raw, signature)) return Response.json({ error: "invalid_signature" }, { status: 403 });
  } catch (error) {
    if (error instanceof RazorpayError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "invalid_signature" }, { status: 403 });
  }
  let event: z.infer<typeof EventBody>;
  try { event = EventBody.parse(JSON.parse(raw)); }
  catch { return Response.json({ error: "invalid_event" }, { status: 400 }); }
  if (event.event !== "payment.captured") return Response.json({ received: true });
  const payment = event.payload.payment.entity;
  if (!payment.order_id || payment.status !== "captured") return Response.json({ received: true });
  const { error } = await db.from("payment_signals").update({
    payment_id: payment.id,
    payment_method: payment.method ?? null,
    status: "paid",
    paid_at: payment.created_at ? new Date(payment.created_at * 1000).toISOString() : new Date().toISOString(),
  }).eq("order_id", payment.order_id).eq("amount_paise", payment.amount);
  if (error) {
    console.error("Payment notification could not update the demo signal");
    return Response.json({ error: "could_not_store_event" }, { status: 500 });
  }
  return Response.json({ received: true });
}
