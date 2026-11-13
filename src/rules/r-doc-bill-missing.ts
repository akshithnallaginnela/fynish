import { rule } from "./util";

export default rule({
  id: "R-DOC-BILL-MISSING",
  title: "Hospital bill received",
  severity: "blocker",
  deduction: 30,
  clauseRefs: (ctx) => [ctx.policy.documentsClauseRef],
  check: (ctx) =>
    ctx.extracted.bill
      ? "pass"
      : {
          reason: "The hospital bill is missing — the insurer can't process without it.",
          whatToDo: "Send a photo of the final itemised hospital bill.",
        },
});
