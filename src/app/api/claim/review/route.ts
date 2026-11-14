import { z } from "zod";
import { db } from "@/lib/db";
import { readSessionId } from "@/lib/provider/session";

type ReviewRow = {
  id: string;
  extracted: { bill?: unknown } | null;
  assessment: { readiness?: unknown; amountSummary?: unknown; citations?: unknown; warnings?: unknown } | null;
  claim_id: string | null;
};

export async function GET(request: Request) {
  const sessionId = readSessionId(request);
  if (!sessionId) return Response.json({ error: "session_missing" }, { status: 401 });
  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("journeyId"));
  if (!id.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  try {
    // The service-role client bypasses RLS; always scope the lookup to the signed session.
    const { data, error } = await db.from("journeys")
      .select("id,extracted,assessment,claim_id")
      .eq("id", id.data).eq("customer_id", sessionId).eq("type", "claim")
      .maybeSingle<ReviewRow>();
    if (error) throw error;
    if (!data || !data.extracted?.bill || !data.assessment?.readiness || !data.assessment.amountSummary) {
      return Response.json({ error: "journey_missing" }, { status: 404 });
    }
    let submission: { claimId: string; status: string } | undefined;
    if (data.claim_id) {
      const { data: claim, error: claimError } = await db.from("mock_claims")
        .select("status").eq("claim_id", data.claim_id).eq("journey_id", id.data)
        .maybeSingle<{ status: string }>();
      if (claimError) throw claimError;
      submission = { claimId: data.claim_id, status: claim?.status ?? "RECEIVED" };
    }
    return Response.json({
      journeyId: data.id,
      bill: data.extracted.bill,
      readiness: data.assessment.readiness,
      amountSummary: data.assessment.amountSummary,
      citations: data.assessment.citations ?? [],
      warnings: data.assessment.warnings ?? [],
      ...(submission ? { submission } : {}),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "review_unavailable" }, { status: 502 });
  }
}
