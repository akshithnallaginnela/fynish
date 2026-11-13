import type { PolicyProfile } from "@/lib/types";
import p from "../../seed/profile.json";

// shortcut: one hard-coded policy from seed/profile.json; load from `policies` table when a second insurer appears
export const demoPolicy: PolicyProfile = {
  id: p.id,
  insurer: p.insurer,
  product: p.product,
  wordingVersion: p.wordingVersion,
  sumInsuredPaise: p.demoPolicy.sumInsuredPaise,
  policyStart: p.demoPolicy.policyStart,
  continuousCoverSince: p.demoPolicy.continuousCoverSince,
  insuredAgeAtEntry: p.demoPolicy.insuredAgeAtEntry,
  roomEntitlement: p.roomEntitlement,
  waitingPeriods: p.waitingPeriods,
  specifiedDiseases: p.specifiedDiseases.codes,
  copay: p.copay,
  claimsProcedure: p.claimsProcedure,
  documentsClauseRef: "Claim form Part A §E–F",
};
