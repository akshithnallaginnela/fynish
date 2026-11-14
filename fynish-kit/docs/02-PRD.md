# Product Requirements Document — Fynish

**Version** 1.0 · **Date** 12 Nov 2026 · **Owner** Akshith Nallaginnela
**Reader** Product owner; anyone deciding what is in or out
**Depends on** `01-BRD.md` for the why; feeds `03-SRS.md` and `04-FRD.md`

---

## 1. Product statement

Fynish watches your payments, knows when a claim or loan is coming, and tells you — with a score and the exact clause — whether it will go through before you submit. Then it finishes it for you, by talking.

## 2. Users and needs

| Persona | Situation | Need |
|---|---|---|
| **Ravi, 34, Hyderabad** — primary | Paid ₹42,000 at a hospital via UPI for his father's 3-day admission; holds a family-floater health policy he bought on an app and has never read | File the reimbursement claim without understanding insurance jargon; know *before* submitting whether it will be paid |
| **Priya, insurer claims ops** — secondary | Receives incomplete submissions, raises queries, repudiates on technicalities | Receive clean, complete submissions with the right documents attached |
| **Human support agent** — secondary | Picks up escalations with no context | A one-page brief so the customer never repeats the story |

## 3. Jobs to be done

1. When a hospital payment happens, start the claim for me with the receipt already attached.
2. Tell me what is missing and what the policy will and will not pay, in my language, before I submit.
3. File it, tell me its status in human words, and get me a human if it stalls.

## 4. Features

### P0 — must demo

| ID | Feature | Description | Acceptance |
|---|---|---|---|
| PR-1 | Payment-signal trigger | A qualifying transaction in the (mock) UPI feed opens a journey and sends the first message with the receipt attached | Hospital-category payment fires; non-qualifying ones do not |
| PR-2 | Conversational intake | Customer replies with text and photos; agent asks only for missing items | Journey reaches "ready to score" with ≤ 3 agent questions on the happy path |
| PR-3 | Document extraction | Hospital bill and discharge summary photos → structured JSON | Fields match the sample documents on manual check |
| PR-4 | Claim Readiness Score | 0–100 with itemised deductions, each citing a clause in the policy wording | Score changes when a document is removed; each deduction opens the clause text |
| PR-5 | Plain-language summary | One screen: what is claimed, what is likely covered, what is not and why, in the customer's language | Customer confirms with one tap |
| PR-6 | Submission | Confirmed claim posted to (mock) insurer API; claim ID returned and stored | Claim ID visible; audit log has the submit event |
| PR-7 | Status tracking | Status shown in human words; proactive update when it changes | Status card updates when mock status advances |
| PR-8 | Human handoff | Below a confidence threshold or on insurer query, a one-page case brief is generated for a human | Brief contains journey summary, documents, score history, open question |

### P1 — stretch on the day

| ID | Feature | Description |
|---|---|---|
| PR-9 | Voice input | Browser speech-to-text for the customer's messages; Indic language output |
| PR-10 | Loan journey | Thin-month signal → EMI Affordability Score on mock cash-flow data → plain-language offer |

### P2 — roadmap (not built)

WhatsApp channel; insurer sandbox API; Account Aggregator and DigiLocker; three Indian languages; compliance review; Fynish Plus.

## 5. Non-goals

- No eligibility decision by an LLM. Rules decide; the LLM reads and explains.
- No real money movement, no real policy purchase.
- No multi-tenant admin console in the MVP.

## 6. User journey (happy path)

```
UPI payment to hospital
  → Fynish: "Looks like a hospital bill. You hold a health policy — want me to file the claim? I already have the receipt."
  → Customer: "yes" (+ photos of discharge summary)
  → Fynish extracts; asks for the one missing item
  → Readiness Score 72 → deductions shown → customer sends missing page → 94
  → One-screen summary in Telugu/Hindi/English → Confirm
  → Submitted; claim ID; status card
  → (if insurer queries) human gets a brief; customer is told in plain words
```

## 7. Release roadmap

| Milestone | Date | Contents |
|---|---|---|
| M0 — Pitch shortlisted | 12 Nov 2026 | Done |
| M1 — Hackathon demo | 13 Nov 2026 | P0 complete on mocks; P1 if time |
| M2 — Pilot-ready alpha | +30 days | One insurer sandbox, 3 languages, WhatsApp |
| M3 — Lending beta | +60 days | Account Aggregator, DigiLocker, EMI Affordability Score |
| M4 — Partner pilot | +90 days | Inside a Paytm partner journey; privacy, audit, compliance review |

## 8. Metrics (pilot)

Time from trigger to submission · documentation-query rate · share of journeys without human touch · score-before vs outcome-after calibration · customer comprehension survey.

## 9. Open questions

- Which insurer's policy wording is the reference document? (Decide tonight; see `06-IMPLEMENTATION-PLAN.md`.)
- Demo language: Telugu or Hindi for the summary card? (Pick one; the other is a stretch.)
