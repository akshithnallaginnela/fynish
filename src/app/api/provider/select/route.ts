import { NextResponse } from "next/server";
import { z } from "zod";
import { routeError, sameOrigin } from "@/lib/provider/http";
import { readSessionId } from "@/lib/provider/session";
import { getConnection, getSessionView, selectPolicy } from "@/lib/provider/server";

const Body = z.object({ policyId: z.string().min(1).max(120) });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  try {
    const sessionId = readSessionId(request);
    if (!sessionId) return NextResponse.json({ error: "session_missing" }, { status: 401 });
    const connection = await getConnection(sessionId);
    if (!connection) return NextResponse.json({ error: "connection_missing" }, { status: 401 });
    const { policyId } = Body.parse(await request.json());
    await selectPolicy(connection, policyId);
    const response = NextResponse.json(await getSessionView(sessionId));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return routeError(error);
  }
}
