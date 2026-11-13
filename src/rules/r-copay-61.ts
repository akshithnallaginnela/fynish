import { rule } from "./util";

export default rule({
  id: "R-COPAY-61",
  title: "No age-based co-payment",
  severity: "info",
  deduction: 0,
  clauseRefs: (ctx) => [ctx.policy.copay.clauseRef],
  check: (ctx) => {
    const { mandatoryAgeAtEntry, mandatoryPct } = ctx.policy.copay;
    if (ctx.policy.insuredAgeAtEntry < mandatoryAgeAtEntry) return "pass";
    return {
      reason: `A ${mandatoryPct}% co-payment applies because the insured was ${mandatoryAgeAtEntry} or older at entry.`,
    };
  },
});
