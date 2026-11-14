# Software Requirements Specification — Fynish

**Version** 1.0 · **Date** 12 Nov 2026
**Reader** Engineer building the system
**Depends on** `02-PRD.md` (features PR-x) · Detailed behaviour in `04-FRD.md`

---

## 1. System overview

Fynish is a single Next.js 15 application (App Router, TypeScript) with API routes, backed by Supabase (Postgres + pgvector). A deterministic journey state machine drives each customer journey through six states. An LLM provider (Anthropic Claude by default, behind an interface) is used only for document extraction and plain-language explanation. Third parties — payment feed, insurer API, KYC — are mocked behind interfaces with the same shape as their real counterparts.

```
[Signals]  mock UPI feed ──┐
[Channels] web chat ───────┼──▶ Journey state machine ──▶ [Systems] mock insurer API
           voice (P1) ─────┘        │        │                      Supabase (journeys, events, chunks)
                                    │        └── Rules engine ──▶ policy chunks (pgvector)
                                    └── LLM provider (extract, explain)
```

## 2. Functional requirements

Each FR maps to a PRD feature. Detailed input/output behaviour is in the FRD.

| ID | Requirement | PRD |
|---|---|---|
| FR-1 | The system SHALL poll or receive payment signals and evaluate each against trigger rules (merchant category, amount threshold, policy on file). | PR-1 |
| FR-2 | On a qualifying signal the system SHALL create a journey in state `triggered` and emit the opening message with the payment receipt attached. | PR-1 |
| FR-3 | The system SHALL accept customer messages as text and image uploads (JPEG/PNG/PDF ≤ 10 MB each). | PR-2 |
| FR-4 | The system SHALL extract structured fields from hospital bills and discharge summaries using the LLM provider with a fixed output schema, and SHALL validate the result against that schema. | PR-3 |
| FR-5 | The system SHALL compute a Claim Readiness Score (integer 0–100) from a set of deterministic rules; each rule SHALL return pass/fail, a point deduction, a human-readable reason, and zero or more clause references. | PR-4 |
| FR-6 | Each clause reference SHALL resolve to a text span in the ingested policy wording, retrievable with surrounding context for display. | PR-4 |
| FR-7 | The system SHALL present a one-screen summary (claimed amount, likely covered, likely not covered with reasons) in the customer's chosen language and require explicit confirmation before submission. | PR-5 |
| FR-8 | On confirmation the system SHALL submit the claim payload to the insurer adapter and store the returned claim ID. | PR-6 |
| FR-9 | The system SHALL show journey status in plain language and update it when the insurer adapter reports a change. | PR-7 |
| FR-10 | When agent confidence < threshold, or the insurer raises a query, the system SHALL generate a case brief and set state `escalated`. | PR-8 |
| FR-11 | The system SHALL record every state transition, LLM call (model, prompt id, token counts), rule evaluation and external call as an event in an append-only log. | all |
| FR-12 | The system SHALL ingest a policy wording PDF into clause-level chunks with embeddings and clause identifiers. | PR-4 |
| FR-13 (P1) | The system SHALL accept voice input via browser speech recognition and render agent messages in the selected Indic language. | PR-9 |
| FR-14 (P1) | The system SHALL run a loan journey using an EMI Affordability Score computed from mock cash-flow data. | PR-10 |

## 3. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Determinism | Given the same extracted data and policy chunks, the Readiness Score SHALL be identical across runs. No LLM output participates in score arithmetic. |
| NFR-2 | Explainability | Every deduction SHALL be traceable to a named rule and, where applicable, a clause span. |
| NFR-3 | Latency | Score computation < 500 ms; extraction round-trip < 20 s; chat response (non-LLM) < 300 ms. |
| NFR-4 | Offline demo | The full happy path SHALL run with no network except the LLM API. All third parties mocked locally. |
| NFR-5 | Privacy | PII fields (name, phone, policy number, ID numbers) SHALL be masked before any LLM call that does not require them; raw images are sent only to the extraction call. |
| NFR-6 | Safety | No submission and no money action SHALL occur without an explicit customer confirmation event in the log. |
| NFR-7 | Auditability | The event log SHALL be append-only and sufficient to reconstruct the journey. |
| NFR-8 | Testability | Rules and the state machine SHALL have unit tests; `npm test` SHALL pass on a fresh clone. |
| NFR-9 | Setup | A fresh clone SHALL run with ≤ 3 commands documented in the README (`npm i`, env copy, `npm run dev`) plus one seed command. |
| NFR-10 | Swappability | LLM provider, payment source and insurer adapter SHALL each be replaceable by implementing one interface. |

## 4. Interfaces

```ts
interface PaymentSignalSource { next(): Promise<PaymentSignal[]> }
interface InsurerAdapter { submit(claim: ClaimPayload): Promise<{ claimId: string }>; status(claimId: string): Promise<ClaimStatus> }
interface LLMProvider {
  extract<T>(images: Blob[], schema: ZodSchema<T>, instructions: string): Promise<T>
  explain(input: ExplainInput, language: Language): Promise<string>
}
interface Rule { id: string; evaluate(ctx: RuleContext): RuleResult }
```

Full types in `starter/types.ts`.

## 5. Data model (Supabase)

| Table | Key columns |
|---|---|
| `journeys` | id, type (`claim`/`loan`), state, customer_id, language, policy_id, extracted jsonb, score int, score_breakdown jsonb, claim_id, created_at, updated_at |
| `events` | id, journey_id, ts, kind (`transition`/`llm_call`/`rule_eval`/`external_call`/`user_action`), payload jsonb — append-only |
| `documents` | id, journey_id, kind (`bill`/`discharge_summary`/`receipt`/`other`), storage_path, extracted jsonb |
| `policies` | id, insurer, product, wording_version, source_pdf |
| `policy_chunks` | id, policy_id, clause_ref, text, page, embedding vector(1536) |
| `mock_claims` | claim_id, journey_id, status, status_history jsonb |

## 6. External dependencies

Anthropic API (vision + messages) · Supabase (Postgres, Storage, pgvector) · `pdf-parse` · Vitest · Next.js 15 · Tailwind + shadcn/ui. No other paid or networked service in the MVP.

## 7. Assumptions

- One reference policy wording PDF, chosen before build starts.
- Customer identity and policy-on-file are seeded, not looked up.
- Language support in the MVP: English plus one Indic language for agent output.

## 8. Acceptance

The SRS is satisfied when every FR-1…FR-12 has a passing manual or automated check listed in `04-FRD.md`, and NFR-1, NFR-4, NFR-6, NFR-8, NFR-9 are demonstrated on a fresh clone.
