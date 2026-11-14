import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sameOrigin } from "@/lib/provider/http";
import { readSessionId } from "@/lib/provider/session";
import { razorpayRequest, verifyCheckoutSignature, RazorpayError } from "@/lib/razorpay";

const Body = z.object({ orderId: z.string().min(8).max(64), paymentId: z.string().min(8).max(64), signature: z.string().regex(/^[a-f0-9]{64}$/i) }).strict();
const Payment = z.object({ id: z.string(), order_id: z.string(), amount: z.number().int(), status: z.string(), method: z.string().optional(), created_at: z.number().optional() });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const sessionId = readSessionId(request);
  if (!sessionId) return NextResponse.json({ error: "session_missing" }, { status: 401 });
  try {
    const { orderId, paymentId, signature } = Body.parse(await request.json());
    if (!verifyCheckoutSignature(orderId, paymentId, signature)) return NextResponse.json({ error: "payment_signature_invalid" }, { status: 403 });
    const { data: order, error: orderError } = await db.from("payment_signals").select("order_id,session_id,amount_paise,hospital_name,status").eq("order_id", orderId).maybeSingle<{
      order_id: string; session_id: string; amount_paise: number; hospital_name: string; status: string;
    }>();
    if (orderError) throw orderError;
    if (!order || order.session_id !== sessionId) return NextResponse.json({ error: "payment_order_missing" }, { status: 404 });
    const payment = Payment.parse(await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`));
    if (payment.id !== paymentId || payment.order_id !== orderId || payment.amount !== order.amount_paise) {
      return NextResponse.json({ error: "payment_details_mismatch" }, { status: 409 });
    }
    if (payment.status === "authorized" || payment.status === "created") {
      return NextResponse.json({ error: "payment_capture_pending" }, { status: 409 });
    }
    if (payment.status !== "captured") {
      return NextResponse.json({ error: "payment_not_captured" }, { status: 409 });
    }
    const paidAt = payment.created_at ? new Date(payment.created_at * 1000).toISOString() : new Date().toISOString();
    const { error } = await db.from("payment_signals").update({
      payment_id: payment.id,
      payment_method: payment.method ?? null,
      status: "paid",
      paid_at: paidAt,
    }).eq("order_id", orderId).eq("session_id", sessionId);
    if (error) throw error;
    return NextResponse.json({ orderId, paymentId, amountPaise: payment.amount, hospitalName: order.hospital_name, paidAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Payment details could not be verified." }, { status: 400 });
    if (error instanceof RazorpayError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Demo payment verification failed");
    return NextResponse.json({ error: "Could not verify this payment. Try refreshing the page." }, { status: 502 });
  }
}
