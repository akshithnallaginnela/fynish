import { NextResponse } from "next/server";
import { z } from "zod";
import { setSimulatedBankCookie, simulatedBankAccount } from "@/lib/bank/simulation";
import { sameOrigin } from "@/lib/provider/origin";
import { readSessionId, sessionIdFor, setSessionCookie } from "@/lib/provider/session";
import { sampleBankLogin } from "@/lib/bank/sample-login";

const Body = z.object({ consent: z.literal(true), accountId: z.literal("fynish-sample-1"), identifier: z.string().max(32), accessCode: z.string().max(32) }).strict();

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  try {
    const body = Body.parse(await request.json());
    if (body.identifier !== sampleBankLogin.identifier || body.accessCode !== sampleBankLogin.accessCode) {
      return NextResponse.json({ error: "Use the prefilled sample login details." }, { status: 401 });
    }
    const existingSession = readSessionId(request);
    const sessionId = existingSession ?? sessionIdFor(request);
    const response = NextResponse.json({ connected: true, source: "simulation", account: simulatedBankAccount }, { headers: { "Cache-Control": "no-store" } });
    if (!existingSession) setSessionCookie(response, sessionId);
    setSimulatedBankCookie(response, sessionId);
    return response;
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Choose the sample account and agree to the connection." }, { status: 400 });
    return NextResponse.json({ error: "Could not connect the sample bank account." }, { status: 503 });
  }
}
