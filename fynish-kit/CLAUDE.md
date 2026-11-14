# CLAUDE.md — Fynish

You are pair-programming on Fynish, a Next.js 15 + TypeScript app that runs an insurance-claim journey: payment trigger → document extraction → deterministic Claim Readiness Score with policy-clause citations → confirmation → mock submission → status and human handoff. One developer, hackathon timeline. Read `docs/06-IMPLEMENTATION-PLAN.md` for the brick order and `docs/04-FRD.md` for exact behaviour.

## Non-negotiables

1. **The LLM never decides.** Score arithmetic, eligibility, and money actions are deterministic TypeScript. The LLM only (a) extracts documents into a zod-validated schema and (b) writes plain-language text with numbers injected from data.
2. **Types in one place.** `src/lib/types.ts`. zod at every boundary: LLM output, API input, payment feed.
3. **Mocks behind interfaces.** `PaymentSignalSource`, `InsurerAdapter`, `LLMProvider`. Never call a mock directly from UI or journey code.
4. **Tests for logic.** Every file in `src/rules/` and `src/journey/` has a test. UI does not need tests.
5. **Append-only events.** Every transition, LLM call, rule evaluation, external call and user action calls `appendEvent()`. Never update or delete an event.
6. **One brick at a time.** Do not start the next brick until the current one's "done when" passes and is committed.

## How to work

- Before writing code for a brick: list files, interfaces and tests in a short plan. Wait for approval.
- Keep diffs small. One brick ≈ one commit. Commit message from the plan table.
- After each brick, answer: what is hacky here; what breaks with a different policy PDF; what did we decide. Add decisions to `DECISIONS.md` as one line each.
- Prefer boring code. No clever abstractions before the third use.
- No new dependency without a one-line reason in `DECISIONS.md`.

## Conventions

- Files: kebab-case. Components: PascalCase. One component per file. One rule per file named `r-<thing>.ts`.
- Rules are pure: `(ctx: RuleContext) => RuleResult`. No I/O inside a rule.
- Prompts live in `src/lib/llm/prompts/<name>.v<N>.ts`; bump the version instead of editing in place.
- Money is integer paise internally, formatted to ₹ with Indian grouping at the edge.
- Agent copy: first person, short sentences, one ask per message, never the words "AI" or "model".
- Tokens from `docs/07-DESIGN.md`; Tailwind classes map to CSS variables; no hex literals in components.

## Commands

`npm run dev` · `npm test` · `npm run seed:policy` · `npm run seed:demo` · `npm run lint`

## Skills

Load the matching skill before the work: `fynish-conventions` (any session), `journey-machine`, `scoring-rules`, `document-extraction`, `ui-build`, `demo-runbook`.
