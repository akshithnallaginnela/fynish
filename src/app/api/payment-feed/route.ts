import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sameOrigin } from "@/lib/provider/http";
import { readSessionId } from "@/lib/provider/session";
import { classifyDemoMerchant } from "@/lib/payment-merchants";

type SignalRow = {
  order_id: string;
  hospital_name: string;
  amount_paise: number;
  payment_id: string | null;
  payment_method: string | null;
  paid_at: string | null;
  seen_at: string | null;
};
const toSignal = (row: SignalRow) => {
  const merchant = classifyDemoMerchant(row.hospital_name);
  return { orderId: row.order_id, hospitalName: row.hospital_name, merchantId: merchant?.id ?? null, category: merchant?.category ?? "unknown", isHospital: merchant?.category === "hospital", amountPaise: row.amount_paise, paymentId: row.payment_id, method: row.payment_method, paidAt: row.paid_at, seen: !!row.seen_at };
};

export async function GET(request: Request) {
  const sessionId = readSessionId(request);
  if (!sessionId) return NextResponse.json({ signals: [] }, { headers: { "Cache-Control": "no-store" } });
  const orderId = new URL(request.url).searchParams.get("orderId");
  let query = db.from("payment_signals").select("order_id,hospital_name,amount_paise,payment_id,payment_method,paid_at,seen_at").eq("session_id", sessionId).eq("status", "paid").order("paid_at", { ascending: false }).limit(10);
  if (orderId) query = query.eq("order_id", orderId);
  const { data, error } = await query.returns<SignalRow[]>();
  if (error) {
    console.error("Payment feed could not be loaded");
    return NextResponse.json({ error: "Could not load payment activity." }, { status: 503 });
  }
  return NextResponse.json({ signals: (data ?? []).map(toSignal) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const sessionId = readSessionId(request);
  if (!sessionId) return NextResponse.json({ error: "session_missing" }, { status: 401 });
  try {
    const { orderId } = z.object({ orderId: z.string().min(8).max(64) }).strict().parse(await request.json());
    const { error } = await db.from("payment_signals").update({ seen_at: new Date().toISOString() }).eq("order_id", orderId).eq("session_id", sessionId).eq("status", "paid");
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid payment alert." }, { status: 400 });
    return NextResponse.json({ error: "Could not update this alert." }, { status: 503 });
  }
}
