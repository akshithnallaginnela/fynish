import { rule } from "./util";

export default rule({
  id: "R-PED-WAIT",
  title: "Pre-existing condition waiting period",
  severity: "info",
  deduction: 0,
  clauseRefs: (ctx) => [ctx.policy.waitingPeriods.preExistingMonths.clauseRef],
  // never auto-fails: needs case evidence
  check: (ctx) => ({
    reason: `Pre-existing conditions have a ${ctx.policy.waitingPeriods.preExistingMonths.months}-month waiting period. We don't assess this automatically.`,
  }),
});
