import { daysBetween, rule } from "./util";

export default rule({
  id: "R-DATE-MISMATCH",
  title: "Bill and discharge summary dates agree",
  severity: "minor",
  deduction: 8,
  clauseRefs: () => ["Claim form Part A §D"],
  check: (ctx) => {
    const { bill, dischargeSummary: ds } = ctx.extracted;
    if (!bill || !ds) return "unknown";
    const off = (a: string, b: string) => Math.abs(daysBetween(a, b)) > 1;
    if (!off(bill.admissionDate, ds.admissionDate) && !off(bill.dischargeDate, ds.dischargeDate)) return "pass";
    return {
      reason: "The dates on the bill and the discharge summary don't match.",
      whatToDo: "Check both pages; send the corrected one.",
    };
  },
});
