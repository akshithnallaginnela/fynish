import type { Rule, RuleContext, ScoreResult } from "@/lib/types";
import billMissing from "./r-doc-bill-missing";
import receiptMissing from "./r-doc-receipt-missing";
import dischargeMissing from "./r-doc-discharge-missing";
import roomCategory from "./r-room-category";
import initialWait from "./r-initial-wait";
import specifiedDiseaseWait from "./r-specified-disease-wait";
import pedWait from "./r-ped-wait";
import copay61 from "./r-copay-61";
import notification from "./r-notification";
import submissionWindow from "./r-submission-window";
import dateMismatch from "./r-date-mismatch";
import sumInsuredExceeded from "./r-sum-insured-exceeded";
import docUnreadable from "./r-doc-unreadable";

export const READY_THRESHOLD = 80;

export const rules: Rule[] = [
  billMissing,
  receiptMissing,
  dischargeMissing,
  roomCategory,
  initialWait,
  specifiedDiseaseWait,
  pedWait,
  copay61,
  notification,
  submissionWindow,
  dateMismatch,
  sumInsuredExceeded,
  docUnreadable,
];

export function evaluateAll(ctx: RuleContext, ruleSet: Rule[] = rules): ScoreResult {
  const breakdown = ruleSet.map((r) => r.evaluate(ctx)).sort((a, b) => b.deduction - a.deduction);
  const failed = breakdown.filter((r) => r.passed === false);
  const score = Math.max(0, Math.min(100, 100 - failed.reduce((s, r) => s + r.deduction, 0)));
  return {
    score,
    breakdown,
    readyToSubmit: score >= READY_THRESHOLD && !failed.some((r) => r.severity === "blocker"),
    computedAt: new Date().toISOString(),
  };
}
