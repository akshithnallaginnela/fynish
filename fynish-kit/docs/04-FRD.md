# Functional Requirements Document — Fynish

**Version** 1.0 · **Date** 12 Nov 2026
**Reader** Engineer and tester
**Depends on** `03-SRS.md` (FR-x). This document specifies *behaviour*: inputs, processing, outputs, errors, and how to verify.

---

## F1 — Payment-signal trigger (FR-1, FR-2)

**Input:** `PaymentSignal { id, ts, amount, merchantName, merchantCategory, upiRef, customerId }` from `PaymentSignalSource`.
**Processing:**
1. Match `merchantCategory ∈ {HOSPITAL, CLINIC, DIAGNOSTIC}` and `amount ≥ 5000`.
2. Look up customer's policies on file; require at least one active health policy.
3. If a journey for this `upiRef` exists, do nothing (idempotent).
4. Create `journeys` row with `state = triggered`, `type = claim`; attach receipt document; log `transition`.
**Output:** Opening agent message: *"Looks like a hospital bill of ₹{amount} at {merchant}. You hold a health policy with {insurer} — want me to file the claim? I already have the receipt."* with Yes / Not now buttons.
**Errors:** no policy on file → no journey, log `skipped: no_policy`. Duplicate → log `skipped: duplicate`.
**Verify:** seed feed has 5 signals; exactly one journey is created; re-running the feed creates none.

## F2 — Conversational intake (FR-3)

**Input:** customer messages: text, images (JPEG/PNG/PDF ≤ 10 MB), button taps.
**Processing:** state `collecting`. Maintain a checklist: `bill`, `discharge_summary`, `prescriptions (optional)`, `id_proof (seeded)`. After each upload, run extraction (F3) and re-evaluate the checklist. Ask for exactly the next missing *required* item, once, in plain language.
**Output:** agent message naming the single missing item, with an example of what it looks like.
**Errors:** unreadable image → *"I couldn't read this one — could you send a clearer photo, with the whole page visible?"* (no crash; log `llm_call` with `outcome = unreadable`). File too large → inline message, no upload.
**Verify:** happy path reaches `scoring` with ≤ 3 agent questions.

## F3 — Document extraction (FR-4)

**Input:** image(s) + document kind.
**Processing:** call `LLMProvider.extract` with a fixed zod schema per kind:
- `HospitalBill { hospitalName, patientName, admissionDate, dischargeDate, roomType, roomRentPerDay, totalAmount, lineItems[] }`
- `DischargeSummary { diagnosis, procedure, admissionDate, dischargeDate, treatingDoctor }`
Validate with zod. Mask `patientName` to initials before any later LLM call.
**Output:** `documents.extracted` populated; `journeys.extracted` merged; log `llm_call` with model, schema id, token counts, latency.
**Errors:** schema validation fails → one retry with the validation error appended to the prompt; second failure → mark `needs_review`, continue with partial data, add a score deduction via rule R-DOC-UNREADABLE.
**Verify:** sample bill → fields equal the hand-checked expected JSON in `fixtures/`.

## F4 — Claim Readiness Score (FR-5, FR-6)

**Input:** `RuleContext { extracted, documents, policy, policyChunks, today }`.
**Processing:** start at 100; evaluate each rule in `rules/`; subtract deductions; clamp 0–100. Rules are pure functions; order-independent. Each `RuleResult { ruleId, passed, deduction, reason, clauseRefs[], severity }`.
Initial rule set (details in `starter/rules.spec.md`):

| Rule | Deduction | Clause type |
|---|---|---|
| R-DOC-DISCHARGE-MISSING | −18 | Claims procedure / documents required |
| R-DOC-BILL-MISSING | −30 | Claims procedure |
| R-ROOM-RENT-CAP | −10 | Room rent sub-limit |
| R-WAITING-PERIOD | −25 | Waiting periods for specified illnesses |
| R-DATE-MISMATCH | −8 | Claims procedure |
| R-INTIMATION-WINDOW | −6 | Claim intimation timeline |
| R-SUM-INSURED-EXCEEDED | −10 | Sum insured |
| R-DOC-UNREADABLE | −5 | — |

**Output:** `ScoreResult { score, breakdown: RuleResult[], readyToSubmit: score ≥ 85 && no severity=blocker }`. Each `clauseRef` resolves via `policy_chunks` to `{ clauseRef, text, page }`.
**Errors:** missing policy chunks → rule returns `passed = null` with reason "policy wording not ingested"; no deduction; surfaced as a warning.
**Verify:** unit test per rule (pass case, fail case); integration test: removing the discharge summary from fixtures lowers the score by exactly 18.

## F5 — Deduction detail view (FR-6)

**Input:** tap on a deduction row.
**Output:** panel with rule reason in plain language, the clause text with the matched span highlighted, page number, and a "What to do" line (e.g., *"Send the discharge summary — the page with diagnosis and dates."*).
**Verify:** every deduction with a clauseRef opens a panel whose text exists in the source PDF.

## F6 — Plain-language summary and confirmation (FR-7)

**Input:** `ScoreResult`, extracted data, language.
**Processing:** `LLMProvider.explain` produces: five lines (what happened, what is claimed, what is likely paid, what is likely not and why, what happens next) in the chosen language. The numbers in the summary are injected from extracted data, not generated.
**Output:** summary card with **Confirm & submit** and **Fix first** buttons. Confirm logs `user_action: confirm`.
**Errors:** LLM failure → English fallback template with the same five lines.
**Verify:** amounts in the card equal `extracted.totalAmount`; confirm event present in log.

## F7 — Submission (FR-8)

**Input:** confirmed journey.
**Processing:** build `ClaimPayload`; call `InsurerAdapter.submit`; store `claim_id`; state `submitted`; log `external_call`.
**Output:** message: *"Filed. Claim ID {id}. I'll tell you the moment anything changes."*
**Errors:** adapter error → state stays `confirmed`, message *"The insurer's system didn't respond — I'll retry in a minute and tell you."*; retry ×3 with backoff; then escalate (F9).
**Verify:** mock adapter returns an ID; log shows one `external_call` per attempt.

## F8 — Status tracking (FR-9)

**Input:** `InsurerAdapter.status(claimId)` on poll or webhook (mock: advances on each call of `/api/mock/insurer/advance`).
**Processing:** map insurer status codes → plain language: `RECEIVED → "Received by the insurer"`, `UNDER_REVIEW → "Being checked"`, `QUERY → "They have a question — I'm on it"`, `APPROVED → "Approved: ₹{amount}"`, `REJECTED → "Rejected — here's why and what we can do"`.
**Output:** status card update + proactive message on change.
**Verify:** advancing the mock status updates the card without reload (polling ≤ 5 s).

## F9 — Human handoff (FR-10)

**Trigger:** confidence < 0.6 on any extraction; insurer `QUERY`; three failed submissions; customer types "human"/"agent".
**Processing:** generate `CaseBrief { journeySummary, documentsList, scoreHistory, openQuestion, suggestedNextStep }`; state `escalated`; log.
**Output:** customer message: *"I've handed this to a person with everything we've done so far — you won't need to repeat anything."* Brief visible at `/handoff/{journeyId}`.
**Verify:** typing "human" produces a brief containing all five sections.

## F10 — Audit log (FR-11)

Every F1–F9 step appends an `events` row. `/journey/{id}/log` renders them chronologically. Verify: happy-path run produces ≥ 12 events including `transition`, `llm_call`, `rule_eval`, `external_call`, `user_action`.

## F11 — Policy ingestion (FR-12)

**Input:** policy PDF path; insurer; product.
**Processing:** `pdf-parse` → split on clause headings (regex on numbering like `4.2`, `Section 6`) → chunk ≤ 800 chars with overlap → embed → insert `policy_chunks` with `clause_ref`.
**Output:** count of chunks; sanity list of detected clause refs.
**Verify:** `npm run seed:policy` prints clause refs including the room-rent and waiting-period clauses.

## State machine

```
triggered → collecting → scoring → (collecting | confirmed) → submitted → tracking → (closed | escalated)
any state → escalated  (handoff triggers)
```
Transitions are the only way state changes; each is a named function in `journey/machine.ts` with a unit test.
