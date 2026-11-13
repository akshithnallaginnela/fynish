import { db } from "@/lib/db";
import type { ClauseLookup } from "@/lib/types";
import { pickChunk } from "./clause-ref";
import { demoPolicy } from "./profile";

export async function lookup(ref: string, policyId = demoPolicy.id): Promise<ClauseLookup | null> {
  // shortcut: loads every chunk of the policy (~100 rows); filter in SQL once a policy has thousands
  const { data, error } = await db
    .from("policy_chunks")
    .select("clause_ref, page, text")
    .eq("policy_id", policyId)
    .order("page");
  if (error) throw error;
  const hit = pickChunk(data, ref);
  return hit ? { clauseRef: hit.clause_ref, page: hit.page, text: hit.text } : null;
}
