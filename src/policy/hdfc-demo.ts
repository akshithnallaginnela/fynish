import type { PolicyProfile } from "@/lib/types";
import { demoPolicy } from "./profile";

// Entire profile and wording are synthetic demo data, not HDFC ERGO policy terms.
export const hdfcDemoPolicy: PolicyProfile = {
  ...demoPolicy,
  id: "pol_hdfc_demo",
  insurer: "HDFC ERGO (mock)",
  product: "Synthetic Health Plan",
  wordingVersion: "DEMO-1",
  sumInsuredPaise: 30_000_000,
  policyStart: "2025-08-01",
  continuousCoverSince: "2025-08-01",
  insuredAgeAtEntry: 31,
  roomEntitlement: { ...demoPolicy.roomEntitlement, clauseRef: "DEMO-ROOM" },
  waitingPeriods: {
    initialDays: { days: 30, clauseRef: "DEMO-WAIT-INITIAL" },
    specifiedDiseaseMonths: { months: 24, clauseRef: "DEMO-WAIT-SPECIFIED" },
    preExistingMonths: { months: 36, clauseRef: "DEMO-WAIT-PED" },
  },
  copay: { mandatoryAgeAtEntry: 61, mandatoryPct: 20, clauseRef: "DEMO-COPAY" },
  claimsProcedure: { ...demoPolicy.claimsProcedure, clauseRef: "DEMO-PROCEDURE" },
  documentsClauseRef: "DEMO-DOCUMENTS",
};

export const hdfcDemoClauses: Record<string, string> = {
  "DEMO-INPATIENT": "SYNTHETIC TERM: Eligible in-patient treatment charges may be claimed after the applicable waiting period, limits, exclusions, and co-payment.",
  "II(1)": "SYNTHETIC TERM: The plan's sum insured limits the total amount payable for covered in-patient treatment.",
  "DEMO-ROOM": "SYNTHETIC TERM: A Single Standard A/C room is covered at this sum insured. Higher room categories may reduce associated expenses.",
  "DEMO-WAIT-INITIAL": "SYNTHETIC TERM: Illness claims in the first 30 days are excluded unless caused by an accident.",
  "DEMO-WAIT-SPECIFIED": "SYNTHETIC TERM: Listed procedures have a 24-month waiting period.",
  "DEMO-WAIT-PED": "SYNTHETIC TERM: Declared pre-existing conditions have a 36-month waiting period.",
  "DEMO-COPAY": "SYNTHETIC TERM: The policy schedule may require co-payment. An additional 20% applies when the insured entered at age 61 or older.",
  "DEMO-PROCEDURE": "SYNTHETIC TERM: Notify the insurer within 24 hours of emergency admission and submit reimbursement documents within 15 days of discharge.",
  "DEMO-DOCUMENTS": "SYNTHETIC TERM: Submit an itemised hospital bill, payment receipt, and discharge summary.",
  "DEMO-EXCL-ADMIN": "SYNTHETIC TERM: Registration, admission, record, and telephone charges are excluded.",
};
