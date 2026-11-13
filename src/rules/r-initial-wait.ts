import { admissionDate, daysBetween, rule } from "./util";

// shortcut: accident detected by keywords in diagnosis; ask the customer instead once the chat collects it
const ACCIDENT = /accident|injury|fracture|trauma|burn/i;

export default rule({
  id: "R-INITIAL-WAIT",
  title: "Past the initial waiting period",
  severity: "blocker",
  deduction: 25,
  clauseRefs: (ctx) => [ctx.policy.waitingPeriods.initialDays.clauseRef],
  check: (ctx) => {
    const admitted = admissionDate(ctx);
    if (!admitted) return "unknown";
    if (ACCIDENT.test(ctx.extracted.dischargeSummary?.diagnosis ?? "")) return "pass";
    const { days } = ctx.policy.waitingPeriods.initialDays;
    const n = daysBetween(ctx.policy.continuousCoverSince, admitted);
    if (n >= days) return "pass";
    return {
      reason: `Your policy is ${n} days old; illnesses in the first ${days} days aren't covered unless caused by an accident.`,
      whatToDo: "A human can check continuity of cover.",
    };
  },
});
