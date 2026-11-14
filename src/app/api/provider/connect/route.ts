import { NextResponse } from "next/server";
import { z } from "zod";
import { callbackUrl, providerBase } from "@/lib/provider/config";
import { pkceChallenge, randomUrlSafe } from "@/lib/provider/crypto";
import { routeError, sameOrigin } from "@/lib/provider/http";
import { sessionIdFor, setAuthCookie, setSessionCookie } from "@/lib/provider/session";
import { ProviderId } from "@/lib/provider/types";

const Body = z.object({ provider: ProviderId });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  try {
    const { provider } = Body.parse(await request.json());
    const sessionId = sessionIdFor(request);
    const state = randomUrlSafe(24);
    const verifier = randomUrlSafe(32);
    const url = new URL("/oauth/authorize", providerBase(provider));
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: "fynish",
      redirect_uri: callbackUrl(),
      state,
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: "S256",
      scope: "profile policies balance claims",
    }).toString();
    const response = NextResponse.json({ url: url.toString() });
    setSessionCookie(response, sessionId);
    setAuthCookie(response, { provider, sessionId, state, verifier, issuedAt: Date.now() });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return routeError(error);
  }
}
