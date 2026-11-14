import { rule } from "./util";

export default rule({
  id: "R-DOC-RECEIPT-MISSING",
  title: "Payment receipt received",
  severity: "major",
  deduction: 8,
  clauseRefs: (ctx) => [ctx.policy.documentsClauseRef],
  check: (ctx) =>
    ctx.extracted.receipt
      ? "pass"
      : { reason: "The payment receipt is missing.", whatToDo: "Send a payment receipt from the hospital." },
});
