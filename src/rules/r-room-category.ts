import { rule } from "./util";

// shortcut: keyword match on free-text roomType from extraction; first hit wins, so order is most-specific first.
// Upgrade to an extraction enum when a bill with an unlisted room name shows up.
const KEYWORDS: Array<[string, string]> = [
  ["suite", "SUITE"],
  ["deluxe", "DELUXE"],
  ["private", "SINGLE_PRIVATE"],
  ["single", "SINGLE_STANDARD_AC"],
  ["twin", "SHARED"],
  ["shared", "SHARED"],
  ["double", "SHARED"],
  ["general", "GENERAL_WARD"],
  ["ward", "GENERAL_WARD"],
];

export const roomCategory = (roomType: string) => {
  const t = roomType.toLowerCase();
  return KEYWORDS.find(([k]) => t.includes(k))?.[1] ?? null;
};

export default rule({
  id: "R-ROOM-CATEGORY",
  title: "Room within policy entitlement",
  severity: "major",
  deduction: 10,
  clauseRefs: (ctx) => [ctx.policy.roomEntitlement.clauseRef],
  check: (ctx) => {
    const roomType = ctx.extracted.bill?.roomType;
    const occupied = roomType ? roomCategory(roomType) : null;
    if (!roomType || !occupied) return "unknown";
    const { bySumInsuredPaise, categoryRank } = ctx.policy.roomEntitlement;
    const eligible =
      bySumInsuredPaise.find((b) => ctx.policy.sumInsuredPaise <= b.upToPaise) ?? bySumInsuredPaise.at(-1)!;
    if (categoryRank[occupied] <= categoryRank[eligible.category]) return "pass";
    return {
      reason: `You stayed in a ${roomType} room; your policy covers a ${eligible.label} at this sum insured. Associated expenses may be reduced proportionately.`,
      whatToDo: "Nothing to send — expect a proportionate reduction. Want me to estimate it?",
    };
  },
});
