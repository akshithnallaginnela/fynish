import { NextResponse } from "next/server";
import { routeError } from "@/lib/provider/http";
import { sessionIdFor, setSessionCookie } from "@/lib/provider/session";
import { getSessionView } from "@/lib/provider/server";

export async function GET(request: Request) {
  const sessionId = sessionIdFor(request);
  try {
    const response = NextResponse.json(await getSessionView(sessionId));
    setSessionCookie(response, sessionId);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return routeError(error);
  }
}
