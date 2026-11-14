# Business Requirements Document — Fynish

**Version** 1.0 · **Date** 12 Nov 2026 · **Owner** Akshith Nallaginnela (Team K8s)
**Reader** Hackathon judges, business stakeholders at Paytm or an insurer/NBFC

---

## 1. Executive summary

India's insurance and lending journeys fail at the customer-facing layer, not at the product layer. Coverage is low (insurance penetration 3.7% of GDP vs 7.3% global), and even covered customers cannot get through a claim: 11% of health claims were rejected in FY24 (₹26,000 crore), and in a LocalCircles survey of 1 lakh+ policyholders, roughly one in two claimants faced rejection or partial approval. The top cause of rejection is documentation error, discovered weeks after submission.

Fynish is an AI journey agent that (a) detects a claim or loan journey from a payment signal, (b) scores whether the submission will go through — citing the exact policy clause — *before* it is submitted, and (c) completes the journey conversationally, in the customer's language, escalating to a human only when confidence drops.

Sources: IRDAI Annual Reports 2023–24 and 2024–25; LocalCircles health-insurance claims survey 2024; NewsBytes/LocalCircles on documentation errors; Insurance Samadhan complaint data (Mar 2025).

## 2. Business problem

| Stakeholder | Pain today | Cost of the pain |
|---|---|---|
| Customer | Forms in English, 20–40 fields, re-typed from documents already on their phone; rejection learned weeks later; "under process" status | Lost claims, unpaid medical bills, lost trust |
| Insurer / lender | Incomplete submissions → queries, re-work, repudiation, disputes (88% of complaints at one grievance platform are rejected claims) | Processing cost per claim, ombudsman exposure, churn |
| Paytm | Payments happen in-app; the insurance or loan that should follow happens elsewhere or not at all | Low attach rate on an existing user base |

## 3. Business objectives

| ID | Objective | Measure (pilot target, to be validated) |
|---|---|---|
| BO-1 | Reduce claims rejected for documentation errors | Share of submissions returned with a documentation query |
| BO-2 | Shorten time from hospital payment to filed claim | Minutes from trigger to submission (target: under 10) |
| BO-3 | Increase insurance and credit attach on Paytm's payment base | Journeys started per 1,000 qualifying payment signals |
| BO-4 | Lower support cost per journey | Share of journeys resolved without a human touch |
| BO-5 | Increase customer confidence | Share of customers who can state what their policy covers after the journey (survey) |

Targets are hackathon hypotheses. No uplift number in this document is a measured result.

## 4. Scope

**In scope (hackathon MVP):** health-insurance reimbursement claim journey, end to end, on mocked payment and insurer integrations; Claim Readiness Score with clause citation on one real policy wording; chat UI with text, photo and (stretch) voice; human-handoff brief.

**In scope (roadmap, 90 days):** loan journey with EMI Affordability Score; one insurer sandbox API; three Indian languages; WhatsApp channel; consented payment signals via Account Aggregator; compliance and privacy review.

**Out of scope:** underwriting decisions, policy sales, real money movement, any decision on eligibility made by an LLM.

## 5. Value proposition and differentiation

1. **Proactive trigger** — the journey starts from the payment, not from the customer finding a form. Only a payments platform can do this; it is a moat, not a feature.
2. **Claim Readiness Score** — a 0–100 number with every deduction tied to a clause in the actual policy PDF. No competing consumer product shows the customer, before submission, whether the claim will go through and why.
3. **Finish, not advise** — the agent files through APIs and tracks status in plain language; a chatbot tells you what to do, Fynish does it.

## 6. Business model

| Stream | When | Mechanism |
|---|---|---|
| Per completed journey | Launch | Insurer/lender pays ₹[__] per clean claim filed or ₹[__] per loan disbursed — revenue only when the customer gets through |
| Journey engine as SaaS | +6 months | Mid-size insurers and NBFCs run Fynish on their own products; licence + usage |
| Fynish Plus (consumer) | Later | Claim concierge for complex or disputed cases; per case or yearly family plan |

**Why the buyer pays:** a completed journey is revenue for the insurer/lender and a closed ticket for support; both already have a known rupee value inside those companies. Pricing blanks are filled after the first pilot conversation, not guessed.

## 7. Return on investment (qualitative, pre-pilot)

- Insurer: each documentation query avoided saves one round of manual review and customer contact; each repudiation avoided removes a potential complaint and ombudsman case.
- Paytm: each journey started in-app is an attach opportunity that previously leaked to another channel.
- Customer: a rejected ₹42,000 claim is ₹42,000 of real loss; the score turns a two-week rejection into a two-minute fix.

## 8. Constraints and assumptions

- Hackathon build: one developer, one day, mocked third parties (payment feed, insurer API, KYC).
- Production requires consented access to payment data (Account Aggregator or Paytm first-party data with consent), insurer APIs, and a privacy/compliance review — all on the roadmap, none required for the MVP.
- Fynish never decides eligibility and never moves money without explicit customer confirmation.

## 9. Success criteria for the hackathon

1. A judge watches a hospital payment trigger a claim, sees the score drop when a document is missing, clicks the deduction, and sees the highlighted clause in the real policy PDF.
2. The repository shows types, tests on the scoring rules, an audit log, and a 3-command setup.
3. The presenter can answer "why not just a chatbot" and "what if the LLM hallucinates" in one sentence each (see `09-JUDGE-QA.md`).
