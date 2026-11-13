import { rule } from "./util";

export default rule({
  id: "R-DOC-UNREADABLE",
  title: "All documents readable",
  severity: "minor",
  deduction: 5,
  clauseRefs: () => [],
  check: (ctx) => {
    const kinds = ctx.extracted.needsReview ?? [];
    if (kinds.length === 0) return "pass";
    return {
      reason: "I couldn't fully read one of your documents.",
      whatToDo: `Send a clearer photo of ${kinds.join(", ").replace(/_/g, " ")}.`,
    };
  },
});
