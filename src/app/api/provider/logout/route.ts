import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/provider/origin";
import { clearAuthCookie, clearSessionCookie, readSessionId } from "@/lib/provider/session";
import { revokeConnection } from "@/lib/provider/server";
import { clearSimulatedBankCookie } from "@/lib/bank/simulation";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const sessionId = readSessionId(request);
  let connectionRevoked = true;
  if (sessionId) {
    try { await revokeConnection(sessionId); }
    catch { connectionRevoked = false; }
  }
  const response = NextResponse.json({ signedOut: true, connectionRevoked }, { status: connectionRevoked ? 200 : 503 });
  clearAuthCookie(response);
  clearSessionCookie(response);
  clearSimulatedBankCookie(response);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
