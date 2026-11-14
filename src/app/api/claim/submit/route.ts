import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { appendEvent } from "@/lib/events";
import { HospitalBill } from "@/lib/types";
import { routeError, sameOrigin } from "@/lib/provider/http";
import { readSessionId } from "@/lib/provider/session";
import { getConnection, providerApi, ProviderError } from "@/lib/provider/server";

const Body = z.object({ journeyId: z.string().uuid(), approved: z.literal(true) });
const Assessment = z.object({
  readiness: z.object({ readyToSubmit: z.boolean() }),
  amountSummary: z.object({ claimedAmountPaise: z.number().int().positive() }),
});
const ClaimResponse = z.object({
  claimId: z.string().min(1),
  status: z.string().min(1),
  submittedAt: z.string().min(1),
});

type JourneyRow = {
  id: string;
  customer_id: string;
  connection_id: string | null;
  provider_policy_id: string | null;
  state: string;
  claim_id: string | null;
  extracted: unknown;
  assessment: unknown;
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  try {
    const sessionId = readSessionId(request);
    if (!sessionId) return NextResponse.json({ error: "session_missing" }, { status: 401 });
    const { journeyId } = Body.parse(await request.json());
    const { data: journey, error: journeyError } = await db.from("journeys")
      .select("id,customer_id,connection_id,provider_policy_id,state,claim_id,extracted,assessment")
      .eq("id", journeyId).maybeSingle<JourneyRow>();
    if (journeyError) throw journeyError;
    if (!journey || journey.customer_id !== sessionId) {
      return NextResponse.json({ error: "journey_missing" }, { status: 404 });
    }
    if (journey.claim_id) {
      const { data: existing, error } = await db.from("mock_claims").select("status").eq("claim_id", journey.claim_id).maybeSingle<{ status: string }>();
      if (error) throw error;
      return NextResponse.json({ claimId: journey.claim_id, status: existing?.status || "RECEIVED" });
    }
    if (journey.state !== "scoring") {
      return NextResponse.json({ error: "journey_not_ready" }, { status: 409 });
    }
    const connection = await getConnection(sessionId);
    if (!connection || journey.connection_id !== connection.id ||
      !connection.selected_policy_id || journey.provider_policy_id !== connection.selected_policy_id) {
      return NextResponse.json({ error: "policy_changed" }, { status: 409 });
    }
    const assessment = Assessment.parse(journey.assessment);
    if (!assessment.readiness.readyToSubmit) {
      return NextResponse.json({ error: "journey_not_ready" }, { status: 409 });
    }
    const { bill } = z.object({ bill: HospitalBill }).parse(journey.extracted);
    if (assessment.amountSummary.claimedAmountPaise !== bill.totalAmountPaise) {
      throw new ProviderError("amount_mismatch", 409, "Claim amount changed. Analyze the bill again.");
    }
    const { data: documents, error: documentsError } = await db.from("documents")
      .select("kind,sha256").eq("journey_id", journeyId).order("kind");
    if (documentsError) throw documentsError;
    if (!documents?.length) return NextResponse.json({ error: "documents_missing" }, { status: 409 });

    try { await appendEvent(journeyId, "user_action", { action: "approve_and_submit" }); }
    catch { console.error("Claim approval event insert failed", journeyId); }

    // Provider mock deduplicates this key if the browser retries after a lost response.
    const claim = ClaimResponse.parse(await providerApi(connection, "/api/claims", {
      method: "POST",
      headers: { "Idempotency-Key": journeyId },
      body: JSON.stringify({
        policyId: connection.selected_policy_id,
        claimedAmountPaise: bill.totalAmountPaise,
        documents,
      }),
    }));
    const { error: claimError } = await db.from("mock_claims").upsert({
      claim_id: claim.claimId,
      journey_id: journeyId,
      status: claim.status,
      status_history: [{ status: claim.status, at: claim.submittedAt }],
    }, { onConflict: "claim_id" });
    if (claimError) throw claimError;
    const { error: updateError } = await db.from("journeys")
      .update({ claim_id: claim.claimId, state: "submitted", updated_at: new Date().toISOString() })
      .eq("id", journeyId).eq("customer_id", sessionId).is("claim_id", null);
    if (updateError) throw updateError;
    try { await appendEvent(journeyId, "external_call", { provider: connection.provider, claimId: claim.claimId, status: claim.status }); }
    catch { console.error("Claim submitted but audit event insert failed", journeyId); }
    return NextResponse.json({ claimId: claim.claimId, status: claim.status });
  } catch (error) {
    return routeError(error);
  }
}
