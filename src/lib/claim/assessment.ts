import type { HospitalBill, PolicyProfile, RuleResult, ScoreResult } from "@/lib/types";
import { evaluateAll } from "@/rules";
import { demoPolicy } from "@/policy/profile";
import { hdfcDemoPolicy } from "@/policy/hdfc-demo";

export type SelectedPolicy = {
  id: string;
  wordingId: string;
  provider: string;
  product: string;
  policyStart: string;
  continuousCoverSince: string;
  insuredAgeAtEntry: number;
  sumInsuredPaise: number;
  coPayPct: number;
};

export type BillItemResult = {
  label: string;
  amountPaise: number;
  status: "covered" | "excluded" | "review";
  reason: string;
  clauseRef?: string;
};

export type AmountSummary = {
  claimedAmountPaise: number;
  balanceCapPaise: number;
  estimatedPayablePaise: number | null;
  estimateUnavailableReason?: string;
  items: BillItemResult[];
};

// Star CIS Excl 34 names these charges; unknown charges stay in review.
const EXCLUDED = /\b(?:registration|admission|record|telephone)\s+charges?\b/i;
const INPATIENT = /\b(?:rooms?|beds?|wards?|icu|nursing|doctors?|consult(?:ation)?s?|surger(?:y|ies)|operations?|procedures?|medicines?|drugs?|pharmac(?:y|ies)|labs?|diagnostics?|radiology|x[ -]?rays?|ct scans?|mri|treatments?)\b/i;

export function profileFor(policy: SelectedPolicy): PolicyProfile {
  const base = policy.provider === "star" ? demoPolicy : hdfcDemoPolicy;
  return {
    ...base,
    id: policy.wordingId,
    product: policy.product,
    sumInsuredPaise: policy.sumInsuredPaise,
    policyStart: policy.policyStart,
    continuousCoverSince: policy.continuousCoverSince,
    insuredAgeAtEntry: policy.insuredAgeAtEntry,
  };
}

export function assessBill(args: {
  bill: HospitalBill;
  dischargeSummary?: { diagnosis: string; procedure: string | null; admissionDate: string; dischargeDate: string; treatingDoctor: string | null; confidence: number };
  receipt?: { amountPaise: number; merchantName: string; paidAt: string; upiRef: string };
  policy: SelectedPolicy;
  remainingBalancePaise: number;
  today: string;
}): { readiness: ScoreResult; amountSummary: AmountSummary; warnings: string[] } {
  const { bill, dischargeSummary, receipt, policy, remainingBalancePaise, today } = args;
  const profile = profileFor(policy);
  const readiness = evaluateAll({
    extracted: { bill, dischargeSummary, receipt, needsReview: bill.confidence < 0.8 ? ["bill"] : [] },
    documents: [{ kind: "bill", extracted: bill }, ...(dischargeSummary ? [{ kind: "discharge_summary" as const, extracted: dischargeSummary }] : [])],
    policy: profile,
    today,
  });
  const roomRule = readiness.breakdown.find((r) => r.ruleId === "R-ROOM-CATEGORY");
  const excludedRef = policy.provider === "star" ? "Excl 34" : "DEMO-EXCL-ADMIN";
  const coveredRef = policy.provider === "star" ? "II(1)" : "DEMO-INPATIENT";
  const items: BillItemResult[] = bill.lineItems.map(({ label, amountPaise }) => {
    if (EXCLUDED.test(label)) return { label, amountPaise, status: "excluded", reason: "This charge is listed as excluded.", clauseRef: excludedRef };
    if (INPATIENT.test(label)) {
      if (/\b(?:rooms?|beds?|wards?|icu)\b/i.test(label) && roomRule?.passed !== true) {
        return { label, amountPaise, status: "review", reason: "Room entitlement needs review.", clauseRef: profile.roomEntitlement.clauseRef };
      }
      return { label, amountPaise, status: "covered", reason: "Potential in-patient expense; insurer checks final eligibility.", clauseRef: coveredRef };
    }
    return { label, amountPaise, status: "review", reason: "No specific matching benefit or exclusion was found." };
  });
  const warnings: string[] = [];
  if (policy.provider !== "star") warnings.push("HDFC ERGO wording is synthetic and may not match a real policy.");
  warnings.push("Pre-existing condition history needs insurer or human review.");
  if (bill.confidence < 0.8) warnings.push("Bill extraction needs a clearer document or manual review.");
  const itemTotalPaise = items.reduce((sum, item) => sum + item.amountPaise, 0);
  if (itemTotalPaise !== bill.totalAmountPaise) warnings.push("Bill line items do not add up to the extracted total.");
  if (items.some((item) => item.status === "review")) warnings.push("Some bill charges need manual review.");
  const unknownCoreRule = readiness.breakdown.some((r: RuleResult) => r.passed === null && (r.severity === "blocker" || r.severity === "major"));
  const canEstimate = bill.confidence >= 0.8 && items.length > 0 && itemTotalPaise === bill.totalAmountPaise &&
    !items.some((item) => item.status === "review") && readiness.readyToSubmit && !unknownCoreRule;
  const coveredPaise = items.filter((item) => item.status === "covered").reduce((sum, item) => sum + item.amountPaise, 0);
  const capPaise = Math.min(bill.totalAmountPaise, Math.max(0, remainingBalancePaise), policy.sumInsuredPaise);
  const effectiveCopayPct = Math.max(policy.coPayPct, policy.insuredAgeAtEntry >= profile.copay.mandatoryAgeAtEntry ? profile.copay.mandatoryPct : 0);
  const estimatedPayablePaise = canEstimate ? Math.floor(Math.min(coveredPaise, capPaise) * (100 - effectiveCopayPct) / 100) : null;
  const amountSummary: AmountSummary = {
    claimedAmountPaise: bill.totalAmountPaise,
    balanceCapPaise: capPaise,
    estimatedPayablePaise,
    ...(canEstimate ? {} : { estimateUnavailableReason: "Policy or document details need review before an amount can be estimated." }),
    items,
  };
  return { readiness, amountSummary, warnings };
}
