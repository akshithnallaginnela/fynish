# DECISIONS.md

One line per decision: what, why, what was rejected. Newest at the bottom. Copy this file into the repo root.

- 2026-11-12 Single Next.js 15 app (App Router, TS) — one process to run and demo solo; rejected React+Express (two servers) and Streamlit (prototype look).
- 2026-11-12 Hand-written TypeScript state machine for the journey — six states, pure transitions, unit-testable; rejected LangGraph (Python service + framework for a six-node graph).
- 2026-11-12 Anthropic Claude behind an `LLMProvider` interface — vision reads bill photos, tool-schema output; rejected provider lock-in by keeping it to one file (`llm/anthropic.ts`).
- 2026-11-12 Deterministic rules compute the Readiness Score; LLM never participates in score arithmetic — auditability and repeatability; rejected LLM-only scoring (drift, un-auditable).
- 2026-11-12 Supabase (Postgres + pgvector + Storage) — journeys, events, clause chunks and files in one project with a free tier; rejected Cloudflare D1/R2/Vectorize (four services + edge adapter for latency not needed) and MongoDB (structured financial data).
- 2026-11-12 Policy limits and clause numbers come from a hand-curated `profile.json`; `pdf-parse` ingestion is for clause *text* and citation — reliable rules on day one; rejected live parsing of limits from the PDF (fragile numbering across insurers; noted as the hardest production problem).
- 2026-11-12 Money as integer paise everywhere; formatted at the edge — avoids float errors; rejected floats in rupees.
- 2026-11-12 Payment feed, insurer API and KYC mocked behind interfaces shaped like the real ones — offline-safe demo; honest about what is mocked in the Q&A.
- 2026-11-12 Voice via browser Web Speech API as a stretch — zero setup; rejected Sarvam/Bhashini for day one (keys, latency risk), kept on roadmap.
- 2026-11-12 Loan journey is P1 — not started until the claim journey (bricks 1–12) is complete and committed.
