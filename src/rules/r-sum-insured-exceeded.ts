import { rupees } from "@/lib/money";
import { rule } from "./util";

export default rule({
  id: "R-SUM-INSURED-EXCEEDED",
  title: "Bill within sum insured",
  severity: "major",
  deduction: 10,
  clauseRefs: () => ["II(1)"],
  check: (ctx) => {
    const bill = ctx.extracted.bill;
    if (!bill) return "unknown";
    if (bill.totalAmountPaise <= ctx.policy.sumInsuredPaise) return "pass";
    return {
      reason: `The bill (${rupees(bill.totalAmountPaise)}) is above your cover of ${rupees(ctx.policy.sumInsuredPaise)}.`,
      whatToDo: "The amount above cover won't be paid.",
    };
  },
});
