import { monthsBetween, rule } from "./util";

export default rule({
  id: "R-SPECIFIED-DISEASE-WAIT",
  title: "No specified-disease waiting period applies",
  severity: "blocker",
  deduction: 25,
  clauseRefs: (ctx) => [ctx.policy.waitingPeriods.specifiedDiseaseMonths.clauseRef],
  check: (ctx) => {
    const ds = ctx.extracted.dischargeSummary;
    if (!ds) return "unknown";
    const text = `${ds.diagnosis} ${ds.procedure ?? ""}`.toLowerCase();
    const hit = ctx.policy.specifiedDiseases.find((d) => d.match.some((m) => text.includes(m)));
    if (!hit) return "pass";
    const { months } = ctx.policy.waitingPeriods.specifiedDiseaseMonths;
    const m = monthsBetween(ctx.policy.continuousCoverSince, ds.admissionDate);
    if (m >= months) return "pass";
    return {
      reason: `${hit.label} has a ${months}-month waiting period and your cover is ${m} months old.`,
      whatToDo: "Expect the insurer to decline this; a human can advise on portability or options.",
    };
  },
});
