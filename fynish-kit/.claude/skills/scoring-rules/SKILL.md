---
name: scoring-rules
description: Use when writing or changing a Claim Readiness Score rule in src/rules. Enforces pure functions, fixed deductions, clause citations from the ingested policy wording, and a test per rule. Also covers how the total score is computed.
---

# Scoring rules

## Contract
```ts
export interface Rule { id: `R-${string}`; title: string; severity: 'blocker'|'major'|'minor'; evaluate(ctx: RuleContext): RuleResult }
export interface RuleResult { ruleId: string; passed: boolean|null; deduction: number; reason: string; clauseRefs: string[]; whatToDo?: string }
```
- `evaluate` is **pure**: no I/O, no Date.now() (use `ctx.today`), no LLM.
- `passed: null` means "could not evaluate" (e.g., policy chunk missing). Deduction 0, reason explains why. Never guess.
- `deduction` is a constant per rule, declared at the top of the file. The total is `clamp(100 - Σ deductions, 0, 100)`.
- `clauseRefs` are strings like `"4.2"` that `lookupClause(policyId, ref)` resolves to text + page. If the rule is about documents only (no clause), `clauseRefs: []`.
- `reason` is customer-facing, one sentence, plain words, includes the numbers (`"Room rent ₹8,000/day is above your 1% cap of ₹5,000"`).
- `whatToDo` is one imperative sentence or omitted.

## File template `src/rules/r-<thing>.ts`
```ts
import { Rule, RuleContext, RuleResult } from '@/lib/types';
const DEDUCTION = 10;
export const rRoomRentCap: Rule = {
  id: 'R-ROOM-RENT-CAP', title: 'Room rent within policy limit', severity: 'major',
  evaluate(ctx: RuleContext): RuleResult {
    const cap = ctx.policy.limits.roomRentPerDayPaise;        // from policy profile, not parsed live
    const actual = ctx.extracted.bill?.roomRentPerDayPaise;
    if (cap == null) return { ruleId: this.id, passed: null, deduction: 0, reason: 'Room-rent limit not found in policy wording', clauseRefs: [] };
    if (actual == null) return { ruleId: this.id, passed: null, deduction: 0, reason: 'Room rent not found on the bill', clauseRefs: [] };
    if (actual <= cap) return { ruleId: this.id, passed: true, deduction: 0, reason: 'Room rent is within your policy limit', clauseRefs: ['4.2'] };
    return { ruleId: this.id, passed: false, deduction: DEDUCTION,
      reason: `Room rent ${inr(actual)}/day is above your limit of ${inr(cap)}/day`, clauseRefs: ['4.2'],
      whatToDo: 'Nothing to send — expect the payout to be reduced for the difference.' };
  },
};
```

## Policy profile
Clause numbers and limits for the reference policy live in `seed/policy/profile.json` (`{ insurer, product, limits: { roomRentPerDayPaise | roomRentPctOfSI, waitingPeriods: [{ code, months, clauseRef }], intimationDays }, clauses: { roomRent: '4.2', waitingPeriods: '6.1', documents: '7.3', intimation: '7.1' } }`). Rules read the profile; `lookupClause` reads the ingested chunks. Rules never parse the PDF at evaluation time.

## Tests (required, one file per rule)
```ts
describe('R-ROOM-RENT-CAP', () => {
  it('passes within cap'); it('deducts 10 above cap and cites 4.2'); it('returns null when bill has no room rent');
});
```
Plus `src/rules/__tests__/score.test.ts`: fixture journey scores 94 with all documents; removing the discharge summary gives exactly 76 (94 − 18); the order of rules does not change the result.

## Adding a rule
1. Add the row to `seed/policy/profile.json` if it needs a clause or limit.
2. Write the test, then the rule, then register it in `src/rules/index.ts`.
3. Update the table in `docs/04-FRD.md` F4 and `starter/rules.spec.md`.
4. Run the fixture test; adjust the expected totals in the test only if the change is intentional, and say so in the commit.

## Things that are not rules
Anything that needs the LLM, anything that needs network, anything that "estimates". Those go in `explain()` as narrative, never in the score.
