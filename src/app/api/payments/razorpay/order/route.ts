import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sameOrigin } from "@/lib/provider/http";
import { readSessionId, sessionIdFor, setSessionCookie } from "@/lib/provider/session";
import { razorpayKeyId, razorpayRequest, RazorpayError } from "@/lib/razorpay";
import { DEMO_MERCHANTS } from "@/lib/payment-merchants";

const Body = z.object({
  merchantId: z.enum(["hospital", "store"]),
}).strict();
const OrderResponse = z.object({ id: z.string().min(1), amount: z.number().int(), currency: z.literal("INR") });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const existingSession = readSessionId(request);
  const sessionId = existingSession ?? sessionIdFor(request);
  try {
    const body = Body.parse(await request.json());
    const merchant = DEMO_MERCHANTS[body.merchantId];
    const hospitalName = merchant.name;
    const order = OrderResponse.parse(await razorpayRequest("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: merchant.amountPaise,
        currency: "INR",
        receipt: `fynish_${randomUUID().replaceAll("-", "").slice(0, 24)}`,
        notes: { fynish_demo: "true", fynish_session_id: sessionId, merchant_id: merchant.id, category: merchant.category },
      }),
    }));
    const { error } = await db.from("payment_signals").insert({
      order_id: order.id,
      session_id: sessionId,
      hospital_name: hospitalName,
      amount_paise: order.amount,
      status: "created",
    });
    if (error) throw new Error("Could not save simulation payment order.");
    const response = NextResponse.json({ orderId: order.id, keyId: razorpayKeyId(), amountPaise: order.amount, currency: order.currency });
    if (!existingSession) setSessionCookie(response, sessionId);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Choose a merchant." }, { status: 400 });
    if (error instanceof RazorpayError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Demo payment order could not be saved");
    return NextResponse.json({ error: "Could not start the payment. Try again." }, { status: 502 });
  }
}
