# Judge Q&A — Fynish

**Reader** Presenter. Rehearse aloud. Answers are one to three sentences; longer answers lose the room.

---

## A. Stack — why this, why not that

| Layer | Choice | Why | Why not the alternative |
|---|---|---|---|
| App | Next.js 15 + TypeScript, single repo | API routes and UI in one process; one `npm run dev`; one deploy | *React + Express:* two servers for no gain. *Streamlit:* reads as a prototype; no real chat UX |
| Journey engine | Hand-written state machine in TS | Six explicit states, pure transition functions, unit-tested, readable in one file | *LangGraph:* a Python service and a framework for a six-node graph; the slide says "state machine" and the code is one |
| LLM | Anthropic Claude behind an `LLMProvider` interface | Vision reads bill photos directly; structured output via schema; swappable in one file | *OpenAI / Gemini:* equally fine — the answer to "why not X" is "one file" |
| Scoring | Deterministic rules + policy-text lookup | Money and eligibility logic must be repeatable and auditable; a rule fires or it doesn't | *LLM-only scoring:* drifts between runs, can't be audited, and invites "what if it hallucinates clause 4.2" |
| Policy wording | `pdf-parse` → chunks in Postgres with pgvector | Clause citation with the real text highlighted; same DB as everything else | *Pinecone / separate vector DB:* another service and key for 40 pages |
| Database | Supabase (Postgres + pgvector + storage) | Journeys, events, chunks and files in one project; free tier; hosted URL for the demo | *Cloudflare D1 + R2 + Vectorize:* four products and an edge-runtime adapter for latency we don't need. *MongoDB:* no reason to go schemaless on structured financial data |
| Documents | Claude vision for bills; `pdf-parse` for policy text | Bills are messy photos; policy PDFs are clean text | *Tesseract:* weak on Indian hospital bills with stamps and mixed fonts. *Document AI:* billing setup you don't have time for |
| Payment signal | Mock UPI feed behind `PaymentSignalSource` | Demo runs offline; the interface shows exactly where Paytm's real feed plugs in | *Real UPI / AA:* regulatory onboarding; impossible in a day and honest to say so |
| Insurer | Mock adapter with the real shape | Demo never depends on a third party; claim ID and status cycle | *Real sandbox:* needs a partnership |
| Voice | Browser Web Speech API (stretch) | Zero setup | *Sarvam / Bhashini:* better Indic quality, more latency risk on the day; on the roadmap |
| Tests | Vitest on rules and state machine | The scoring logic is the product | *No tests:* then "not vibecoded" is only a claim |

**The one-line version for a non-technical judge:** "Everything that touches money or eligibility is deterministic code you can read. The AI does two things only — read messy documents and explain in plain language. That's why an insurer could actually ship this."

## B. The hard questions

**"Isn't this just RAG over a PDF?"**
RAG finds the clause. The rules decide whether it applies to this claim. The score is the output of rules, not of a prompt — here's the rule file. *(Open `rules/r-room-rent-cap.ts`.)*

**"What if the LLM hallucinates?"**
It can't change the score. It reads documents into a schema that's validated, and it writes the plain-language summary with numbers injected from data, not generated. If extraction fails validation, we retry once, then flag for review and deduct points.

**"Who's liable when the score says 94 and the claim is still rejected?"**
Fynish never decides eligibility. It's a readiness check against the policy's own wording, shown with the clause so the customer can see the reasoning. The insurer decides; we just make sure they get a complete, correct file.

**"How is this different from the insurer's own app or chatbot?"**
Two things no insurer app does: it starts from the payment — only a payments platform can — and it tells you before submission whether the claim will go through and why. A chatbot waits to be asked and answers questions; Fynish does the work.

**"Privacy — you're reading my payments."**
With consent, and only for categories the customer opts into. In production that runs through Account Aggregator consent or Paytm's own consented data; the MVP uses a mock feed. PII is masked before any LLM call that doesn't need it, and every action is logged.

**"Why would Paytm want this?"**
The payment already happened in Paytm. Today the insurance or loan that should follow happens elsewhere or not at all. This turns a payment into the start of a journey — attach rate on a base they already have, and a reason to open the app after the payment, not just for it.

**"Business model?"**
Insurers and lenders pay per completed journey — a clean claim filed, a loan disbursed. We earn only when the customer gets through. Later, the engine as SaaS for mid-size insurers and NBFCs, and a consumer concierge tier for disputed claims.

**"Why solo?"**
Scope was chosen for one builder: one journey, mocked third parties, tests on the part that matters. Everything in the demo runs on a fresh clone in three commands.

**"What's fake?"**
The UPI feed, the insurer API and KYC are mocked behind the same interfaces the real ones would use. The document reading, the policy wording, the rules, the score and the clause citations are real.

**"What would you build next?"**
One insurer sandbox API, three Indian languages, WhatsApp as a channel, and the loan journey with an EMI Affordability Score from consented cash flow — same engine, different rules.

**"What's the hardest technical problem?"**
Clause detection in policy PDFs — numbering styles vary by insurer. The MVP uses a regex over headings plus embeddings; production needs a per-insurer ingestion profile. We say so in `DECISIONS.md`.

## C. Things not to say

- Any percentage uplift as if measured. Say "target" or "hypothesis".
- "The AI decides." It never does.
- "We integrated with Paytm." You mocked a feed shaped like one.
