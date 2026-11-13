import { daysBetween, dischargeDate, rule } from "./util";

export default rule({
  id: "R-SUBMISSION-WINDOW",
  title: "Within the filing window",
  severity: "minor",
  deduction: 8,
  clauseRefs: (ctx) => [ctx.policy.claimsProcedure.clauseRef],
  check: (ctx) => {
    const discharged = dischargeDate(ctx);
    if (!discharged) return "unknown";
    const { reimbursementSubmitWithinDays } = ctx.policy.claimsProcedure;
    const n = daysBetween(discharged, ctx.today);
    if (n <= reimbursementSubmitWithinDays) return "pass";
    return {
      reason: `Reimbursement claims should be filed within ${reimbursementSubmitWithinDays} days of discharge; it has been ${n}.`,
      whatToDo: "Submit today.",
    };
  },
});
