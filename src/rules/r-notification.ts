import { hoursBetween, rule } from "./util";

export default rule({
  id: "R-NOTIFICATION",
  title: "Insurer notified in time",
  severity: "minor",
  deduction: 6,
  clauseRefs: (ctx) => [ctx.policy.claimsProcedure.clauseRef],
  check: (ctx) => {
    const a = ctx.admission;
    if (!a) return "unknown";
    const { emergencyNotifyWithinHours, plannedNotifyBeforeHours } = ctx.policy.claimsProcedure;
    const whatToDo = "Submit now — a human can add a delay note. This is a review flag, not a rejection.";
    if (a.emergency) {
      const h = Math.round(hoursBetween(a.admittedAt, a.notifiedAt));
      if (h <= emergencyNotifyWithinHours) return "pass";
      return {
        reason: `The insurer should be told within ${emergencyNotifyWithinHours} hours of an emergency admission; this one was ${h} hours.`,
        whatToDo,
      };
    }
    const h = Math.round(hoursBetween(a.notifiedAt, a.admittedAt));
    if (h >= plannedNotifyBeforeHours) return "pass";
    return {
      reason: `A planned admission should be notified ${plannedNotifyBeforeHours} hours before; this one was ${Math.max(h, 0)} hours.`,
      whatToDo,
    };
  },
});
