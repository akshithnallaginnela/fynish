# Fynish — Build Kit

**Direction update, 13 Nov 2026:** The claim demo now begins with insurer selection and a mock provider connection. UPI triggers are deferred. See the [provider connection ADR](../docs/adr/0001-provider-connected-claim-flow.md) and [domain glossary](../docs/GLOSSARY.md). The implementation plan is updated; documents 01–05 and 07–09 still describe the earlier payment-trigger plan.

**Product:** Fynish — an AI journey agent that sees an insurance claim (or loan) coming from a payment signal, scores whether it will go through before submission, and finishes it for the customer.
**Event:** Paytm AI Hackathon, Hyderabad · Track: Make Insurance, Lending and Fintech simpler, faster and more human
**Team:** Team K8s · Akshith Nallaginnela (solo) · akshithnallaginnela@gmail.com

This folder is everything that is *not* code: the requirement documents, the design spec, the implementation plan, and the Claude Code skills that keep the build disciplined.

## Reading order

| # | File | Reader | Answers |
|---|------|--------|---------|
| 1 | `docs/01-BRD.md` | Judges, business stakeholders | Why does this deserve to exist? What is the business case? |
| 2 | `docs/02-PRD.md` | Product owner (you) | What are we building, for whom, and what is in/out of scope? |
| 3 | `docs/03-SRS.md` | Engineer | What must the system do, exactly, and how well? |
| 4 | `docs/04-FRD.md` | Engineer, tester | How does each function behave, input to output? |
| 5 | `docs/05-PROJECT-CHARTER.md` | Project manager (you) | Milestones, resources, risks, definition of done |
| 6 | `docs/06-IMPLEMENTATION-PLAN.md` | Builder | Brick-by-brick order with "done when" tests |
| 7 | `docs/07-DESIGN.md` | Designer / front-end | Tokens, screens (scribbles), component references |
| 8 | `docs/08-DEMO-SCRIPT.md` | Presenter | The 4-minute demo, word for word |
| 9 | `docs/09-JUDGE-QA.md` | Presenter | Stack rationale and the hard questions |

## Claude Code skills (`.claude/skills/`)

Copy the `.claude/` folder and `CLAUDE.md` into the root of the `fynish` repo. Claude Code loads `CLAUDE.md` automatically and the skills on demand.

| Skill | Use it when |
|-------|-------------|
| `fynish-conventions` | Starting any coding session — naming, folders, commit rules |
| `journey-machine` | Adding or changing a state in the six-step journey |
| `scoring-rules` | Writing a Readiness Score rule (always with a test and a clause citation) |
| `document-extraction` | Touching the bill / discharge-summary extraction prompt or schema |
| `ui-build` | Building any screen — tokens, components, what not to do |
| `demo-runbook` | The last two hours — seeding, rehearsing, backup video |

## Starter files (`starter/`)

- `types.ts` — the data shapes every brick builds against. Copy into `src/lib/types.ts` first.
- `mock-upi-feed.json` — five transactions; exactly one should fire the trigger.
- `rules.spec.md` — the eight scoring rules in plain language, with the clause each cites.

## One rule

Documents describe the build; they do not replace it. If a doc and the running code disagree on demo day, the code wins and the doc gets a one-line correction afterwards.
