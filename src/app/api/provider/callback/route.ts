import { NextResponse } from "next/server";
import { z } from "zod";
import { appOrigin, callbackUrl, providerBase } from "@/lib/provider/config";
import { randomUrlSafe } from "@/lib/provider/crypto";
import { clearAuthCookie, readAuthCookie, readSessionId } from "@/lib/provider/session";
import { saveConnection } from "@/lib/provider/server";
import { ProviderAccount, ProviderId, TokenResponse } from "@/lib/provider/types";

const AuthTransaction = z.object({
  provider: ProviderId,
  sessionId: z.string().uuid(),
  state: z.string().min(20),
  verifier: z.string().min(40),
  issuedAt: z.number().int(),
});

function popupResult(success: boolean, provider?: string) {
  const type = success ? "fynish-provider-connected" : "fynish-provider-error";
  const payload = JSON.stringify({ type, provider });
  const target = JSON.stringify(appOrigin());
  const nonce = randomUrlSafe(16);
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Fynish provider connection</title><body><h1>${success ? "Connected" : "Connection failed"}</h1><p>${success ? "Return to Fynish to continue." : "Close this page and try again in Fynish."}</p><script nonce="${nonce}">history.replaceState(null,"","/api/provider/callback");if(window.parent!==window){window.parent.postMessage(${payload},${target})}else if(window.opener){window.opener.postMessage(${payload},${target});window.close()}else{location.replace("/claim${success ? "" : "?connection_error=1"}")}</script></body></html>`;
  const response = new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors ${appOrigin()}`,
    },
  });
  clearAuthCookie(response);
  return response;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const sessionId = readSessionId(request);
  const transaction = AuthTransaction.safeParse(readAuthCookie(request));
  if (!sessionId || !transaction.success) return popupResult(false);
  const { provider, state, verifier, issuedAt } = transaction.data;
  if (query.get("error") || !query.get("code") || query.get("state") !== state ||
      query.get("iss") !== providerBase(provider) || transaction.data.sessionId !== sessionId ||
      issuedAt > Date.now() || Date.now() - issuedAt > 300_000) {
    return popupResult(false);
  }

  try {
    const response = await fetch(`${providerBase(provider)}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: "fynish",
        code: query.get("code")!,
        redirect_uri: callbackUrl(),
        code_verifier: verifier,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return popupResult(false);
    const token = TokenResponse.parse(await response.json());
    const accountResponse = await fetch(`${providerBase(provider)}/api/me`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!accountResponse.ok) return popupResult(false);
    const account = ProviderAccount.parse(await accountResponse.json());
    await saveConnection({
      sessionId,
      provider,
      accountId: account.id,
      accessToken: token.access_token,
      expiresIn: token.expires_in,
      scope: token.scope,
    });
    return popupResult(true, provider);
  } catch {
    console.error("Provider callback failed");
    return popupResult(false);
  }
}
