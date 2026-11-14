# Project Charter — Fynish @ Paytm AI Hackathon

**Version** 1.0 · **Date** 12 Nov 2026
**Reader** Project manager (you, tonight and tomorrow)

---

## 1. Purpose

Deliver a working demo of Fynish's health-claim journey — payment trigger → extraction → Claim Readiness Score with clause citation → confirmation → mock submission → status and handoff — on hackathon day, with a repository that reads as engineering, not improvisation.

## 2. Deliverables

| # | Deliverable | Definition of done |
|---|---|---|
| D1 | Pitch deck (11 slides) | Submitted and shortlisted — done |
| D2 | `fynish` repository | Fresh clone runs in 3 commands + seed; `npm test` passes; README with architecture diagram |
| D3 | Demo (4 min) | Script in `08-DEMO-SCRIPT.md` runs end to end on mocks; backup video recorded |
| D4 | Reference policy ingested | Clause refs for room-rent and waiting-period detected and displayed |
| D5 | Judge Q&A sheet | `09-JUDGE-QA.md` rehearsed |

## 3. Milestones

| When | Milestone | Exit test |
|---|---|---|
| Tonight 12 Nov, by 20:00 | Repo skeleton, types, decisions, policy PDF chosen, sample bill photo obtained | `npm run dev` shows empty chat; `DECISIONS.md` has ≥ 5 entries |
| Tonight by 23:00 | Rules engine with tests; policy ingestion | `npm test` green on 8 rules; seed prints clause refs |
| 13 Nov, hour 1–2 | Mock feed + trigger + journey table | One journey created from seed feed |
| Hour 3–4 | Extraction on real bill photo | Fixture JSON matches |
| Hour 5–6 | Score UI with deduction → clause panel | Score drops/recovers on document remove/add |
| Hour 7 | Summary card + confirm + mock submit + status | Claim ID shown; status advances |
| Hour 8 | Handoff brief; audit log view | "human" produces a brief |
| Last 2 hours | Polish, voice (if time), demo rehearsal ×3, backup video | Video saved on phone and laptop |

Adjust hours to the actual event schedule; the *order* does not change.

## 4. Resources

- People: Akshith (build, design, demo). Claude Code as pair programmer, bound by `CLAUDE.md` and the skills in `.claude/skills/`.
- Accounts: Anthropic API key, Supabase project (free tier), GitHub repo.
- Assets: one public policy wording PDF; one real hospital bill photo (own, anonymised) and one discharge summary photo or a realistic sample; mock UPI feed JSON.
- Hardware: laptop, phone for backup video, charger, mobile hotspot.

## 5. Scope boundaries

In: everything under PRD P0. Stretch: P1. Out: real integrations, loan journey if P0 is not complete, any admin console.

## 6. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Venue Wi-Fi fails during demo | Medium | High | Hotspot; LLM calls are the only network need; cached extraction results for the demo documents as a fallback switch (`DEMO_CACHE=1`) |
| LLM API latency or outage | Low–Medium | High | Same cache switch; backup video |
| Policy PDF has no clean clause numbering | Medium | Medium | Choose PDF tonight; if numbering is poor, hand-annotate the 4 clauses used by the rules in `fixtures/clauses.json` |
| Extraction wrong on real bill | Medium | Medium | Fixture-first: extraction is validated against a hand-checked JSON; a demo bill that extracts reliably is chosen tonight |
| Scope creep into the loan journey | High | Medium | Loan is explicitly P1; not started until F1–F10 pass |
| Solo fatigue | High | Medium | Bricks are small and independently demo-able; stop after hour 8 if needed — the demo already works |

## 7. Communication

Progress is the commit log. Each brick ends with a commit whose message names the brick and its test. Decisions go in `DECISIONS.md` as they are made.

## 8. Success criteria

See BRD §9. Short form: the score drops when a document is missing, the clause appears when the deduction is tapped, the repo has tests, and the presenter can explain any file a judge points at.

## 9. Approval

Owner: Akshith Nallaginnela. No one else needs to sign; that is the advantage of a team of one.
