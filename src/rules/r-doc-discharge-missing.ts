import { rule } from "./util";

export default rule({
  id: "R-DOC-DISCHARGE-MISSING",
  title: "Discharge summary received",
  severity: "major",
  deduction: 18,
  clauseRefs: (ctx) => [ctx.policy.documentsClauseRef],
  check: (ctx) =>
    ctx.extracted.dischargeSummary
      ? "pass"
      : {
          reason: "The discharge summary is missing.",
          whatToDo: "Send the discharge summary — the page with diagnosis and dates.",
        },
});
