import { NextResponse } from "next/server";
import { routeError, sameOrigin } from "@/lib/provider/http";
import { readSessionId } from "@/lib/provider/session";
import { revokeConnection } from "@/lib/provider/server";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  try {
    const sessionId = readSessionId(request);
    if (sessionId) await revokeConnection(sessionId);
    const response = NextResponse.json({ connected: false });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return routeError(error);
  }
}
