---
name: fynish-conventions
description: Load at the start of any Fynish coding session. Project layout, naming, types-first and tests-first rules, commit discipline, and the brick workflow. Use before planning or writing any code in the fynish repo.
---

# Fynish conventions

## Before touching code
1. Read `CLAUDE.md` and the current brick row in `docs/06-IMPLEMENTATION-PLAN.md`.
2. Read `src/lib/types.ts`. If the brick needs a new type, add it there first, in its own small commit if the change is non-trivial.
3. Write the plan: files to add/change, interfaces, tests, "done when". Three to eight lines. Wait for a go.

## Layout (do not invent new top-level folders)
`src/app` routes and API · `src/lib` types, db, events, llm · `src/journey` state machine and steps · `src/rules` one rule per file + tests · `src/adapters` mocks and real integrations behind interfaces · `src/policy` ingest and lookup · `src/components` UI · `seed/` assets and fixtures · `scripts/` seeding.

## Naming
- Files kebab-case; components PascalCase; rules `r-<thing>.ts`; tests `<name>.test.ts` beside the code or in `__tests__/`.
- Functions are verbs (`evaluateAll`, `appendEvent`, `lookupClause`); types are nouns.
- Event kinds: `transition | llm_call | rule_eval | external_call | user_action`.

## Boundaries
- zod schema at every boundary. Parse, don't cast.
- No mock called directly from UI or journey code — always through its interface.
- No hex colours in components; use the CSS variables from `docs/07-DESIGN.md`.
- No new dependency without a line in `DECISIONS.md`.

## Tests
- Anything in `src/rules/` or `src/journey/`: test first, then implementation.
- Fixtures live in `seed/fixtures/`; expected JSON is hand-checked once and then treated as truth.
- `npm test` must be green before every commit.

## Commits
- One brick, one commit, message from the plan table (`feat: ...`, `chore: ...`, `fix: ...`).
- Never commit secrets; `.env.example` lists every variable with a comment.

## After each brick
Answer in three lines: what is hacky; what breaks with a different policy PDF or bill layout; what was decided. Put the decision in `DECISIONS.md` as `- <date> <decision> — because <reason>; rejected <alternative>`.

## Scope guard
If a request is not required by the current brick's "done when", say so and propose doing it after the brick. The loan journey, voice, WhatsApp and multi-language are P1/P2 until bricks 1–12 are done.
