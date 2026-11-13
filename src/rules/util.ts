import type { Rule, RuleContext, RuleResult, Severity } from "@/lib/types";

type Fail = { reason: string; whatToDo?: string };

// A rule is pass, fail (with customer-facing text), or unknown (missing input: no deduction).
export function rule(def: {
  id: `R-${string}`;
  title: string;
  severity: Severity;
  deduction: number;
  clauseRefs: (ctx: RuleContext) => string[];
  check: (ctx: RuleContext) => Fail | "pass" | "unknown";
}): Rule {
  return {
    id: def.id,
    title: def.title,
    severity: def.severity,
    evaluate(ctx): RuleResult {
      const r = def.check(ctx);
      const base = { ruleId: def.id, severity: def.severity, clauseRefs: def.clauseRefs(ctx) };
      if (r === "pass") return { ...base, passed: true, deduction: 0, reason: def.title };
      if (r === "unknown") return { ...base, passed: null, deduction: 0, reason: def.title };
      return { ...base, passed: false, deduction: def.deduction, reason: r.reason, whatToDo: r.whatToDo };
    },
  };
}

const DAY = 86_400_000;
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);
export const hoursBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 3_600_000;
export const monthsBetween = (from: string, to: string) => Math.floor(daysBetween(from, to) / 30.44);

export const admissionDate = (ctx: RuleContext) =>
  ctx.extracted.dischargeSummary?.admissionDate ?? ctx.extracted.bill?.admissionDate;
export const dischargeDate = (ctx: RuleContext) =>
  ctx.extracted.dischargeSummary?.dischargeDate ?? ctx.extracted.bill?.dischargeDate;
