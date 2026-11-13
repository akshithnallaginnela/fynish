import { createClient } from "@supabase/supabase-js";
import type { Journey } from "./types";

// server-only client: service role bypasses RLS, never ship to the browser
export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type JourneyRow = {
  id: string;
  type: Journey["type"];
  state: Journey["state"];
  customer_id: string;
  policy_id: string | null;
  language: Journey["language"];
  extracted: Journey["extracted"];
  score: number | null;
  score_breakdown: Journey["scoreBreakdown"];
  claim_id: string | null;
  created_at: string;
  updated_at: string;
};

const toJourney = (r: JourneyRow): Journey => ({
  id: r.id,
  type: r.type,
  state: r.state,
  customerId: r.customer_id,
  policyId: r.policy_id,
  language: r.language,
  extracted: r.extracted,
  score: r.score,
  scoreBreakdown: r.score_breakdown,
  claimId: r.claim_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function insertJourney(j: Pick<Journey, "type" | "customerId"> & Partial<Pick<Journey, "policyId" | "language">>) {
  const { data, error } = await db
    .from("journeys")
    .insert({ type: j.type, customer_id: j.customerId, policy_id: j.policyId ?? null, language: j.language ?? "en" })
    .select()
    .single<JourneyRow>();
  if (error) throw error;
  return toJourney(data);
}

export async function getJourney(id: string) {
  const { data, error } = await db.from("journeys").select().eq("id", id).single<JourneyRow>();
  if (error) throw error;
  return toJourney(data);
}
