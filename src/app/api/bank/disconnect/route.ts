import { NextResponse } from "next/server";
import { clearSimulatedBankCookie } from "@/lib/bank/simulation";
import { sameOrigin } from "@/lib/provider/origin";

export function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const response = NextResponse.json({ connected: false, source: "simulation" }, { headers: { "Cache-Control": "no-store" } });
  clearSimulatedBankCookie(response);
  return response;
}
