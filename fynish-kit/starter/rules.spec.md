# Readiness Score — rule specification (v2, aligned to Star Health Family Health Optima 2026 CIS)

Reference document for citations: **Star Health Family Health Optima — Customer Information Sheet, UIN SHAHLIP26046V092526, CIS / FHO / V.6 / 2026** (16 pages). Ingest this file. Keep the full 2026 policy wording in `seed/reference/` for inspection; do not mix 2023 clause numbers with 2026.

Start at 100. Subtract each failed rule's deduction. Clamp 0–100. `readyToSubmit = score ≥ 80 && no failed blocker`. Informational rules (deduction 0) still appear in the breakdown.

| Rule id | Severity | Deduction | Fails when | CIS clause · page | Customer-facing reason (template) | What to do |
|---|---|---|---|---|---|---|
| R-DOC-BILL-MISSING | blocker | 30 | No `hospital_bill` with valid extraction | Claim form Part A §E–F (document checklist) | "The hospital bill is missing — the insurer can't process without it." | "Send a photo of the final itemised hospital bill." |
| R-DOC-RECEIPT-MISSING | major | 8 | No `payment_receipt` (UPI receipt counts) | Claim form Part A §E–F | "The payment receipt is missing." | "Send the payment receipt — the UPI confirmation works." |
| R-DOC-DISCHARGE-MISSING | major | 18 | No `discharge_summary` with valid extraction | Claim form Part A §E–F | "The discharge summary is missing." | "Send the discharge summary — the page with diagnosis and dates." |
| R-ROOM-CATEGORY | major | 10 | `bill.roomType` category rank > eligible category rank for the sum insured (₹5,00,000 → Single Standard A/C Room) | II(1)(i) · p.9 | "You stayed in a {occupied} room; your policy covers a {eligible} room at this sum insured. Associated expenses may be reduced proportionately." | "Nothing to send — expect a proportionate reduction. Want me to estimate it?" |
| R-INITIAL-WAIT | blocker | 25 | Non-accident illness and `admissionDate − policyStart < 30 days` (first policy, no continuous cover) | III(3), Excl 03 · p.7 | "Your policy is {n} days old; illnesses in the first 30 days aren't covered unless caused by an accident." | "A human can check continuity of cover." |
| R-SPECIFIED-DISEASE-WAIT | blocker | 25 | `dischargeSummary.diagnosis` or `procedure` matches the published 24-month list (profile.json `specifiedDiseases`) **and** continuous cover < 24 months | III(2), Excl 02 · p.7–8 | "{condition} has a 24-month waiting period and your cover is {m} months old." | "Expect the insurer to decline this; a human can advise on portability or options." |
| R-PED-WAIT | info | 0 | Always informational: PED needs case evidence; never auto-fail | III(1), Excl 01 · p.8 | "Pre-existing conditions have a 36-month waiting period. We don't assess this automatically." | — |
| R-COPAY-61 | info | 0 | `insured.ageAtEntry ≥ 61` | II(28), II(30) · p.12 | "A 20% co-payment applies because the insured was 61 or older at entry." | — |
| R-NOTIFICATION | minor | 6 | Emergency admission and `notifiedAt − admissionAt > 24h` (planned: notified < 48h before admission) | Claims procedure, IV(2) · p.12 | "The insurer should be told within 24 hours of an emergency admission; this one was {h} hours." | "Submit now — a human can add a delay note. This is a review flag, not a rejection." |
| R-SUBMISSION-WINDOW | minor | 8 | `today − dischargeDate > 15 days` | Claims procedure · p.13 | "Reimbursement claims should be filed within 15 days of discharge; it has been {n}." | "Submit today." |
| R-DATE-MISMATCH | minor | 8 | Bill and discharge-summary admission/discharge dates differ by > 1 day | Claim form Part A §D | "The dates on the bill and the discharge summary don't match." | "Check both pages; send the corrected one." |
| R-SUM-INSURED-EXCEEDED | major | 10 | `bill.totalAmountPaise > policy.sumInsuredPaise` | II(1) · p.3 | "The bill (₹{total}) is above your cover of ₹{si}." | "The amount above cover won't be paid." |
| R-DOC-UNREADABLE | minor | 5 | Any document in `extracted.needsReview` | — | "I couldn't fully read one of your documents." | "Send a clearer photo of {kind}." |

## Demo fixture (SYNTHETIC TEST CASE — NOT A REAL PATIENT OR CLAIM)

Policy: FHO, SI ₹5,00,000, start 14 months before admission, insured age at entry 34, continuous cover. Admission: emergency, notified same day. Diagnosis: acute appendicitis (not on the 24-month list). Room: Single Private (deluxe) at ₹8,000/day — above the Single Standard A/C entitlement. Bill ₹42,000. Discharged 1 day before the demo.

| Documents present | Failing rules | Score | Label |
|---|---|---|---|
| receipt + bill | R-DOC-DISCHARGE-MISSING, R-ROOM-CATEGORY | **72** | Needs 1 fix · 1 note |
| receipt + bill + discharge summary | R-ROOM-CATEGORY | **82** | Ready — 1 note (proportionate deduction expected) |

Optional second demo (dossier case C): same fixture with procedure "inguinal hernia repair" → R-SPECIFIED-DISEASE-WAIT fires → **57**, blocker, "will likely be rejected". Show only if time allows; it's the strongest proof that the rules read the list.

## Order independence
`evaluateAll` sorts results by deduction desc for display only; the total must be identical regardless of evaluation order. The test shuffles the rule array and asserts equal scores.
