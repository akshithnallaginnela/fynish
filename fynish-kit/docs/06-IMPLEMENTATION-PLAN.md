# Implementation Plan — Fynish

**Updated:** 13 Nov 2026  
**Demo flow:** welcome → name and insurer → provider-owned demo sign-in in a page modal → policy and balance → optional payment alert → bill upload → assessment → approval → mock claim filing. The assistant supports English, Telugu, and Hindi, with script matching for native and Roman input.

See the [provider flow ADR](../../docs/adr/0001-provider-connected-claim-flow.md) and [domain glossary](../../docs/GLOSSARY.md).

## Demo setup

1. Configure Supabase, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `PROVIDER_TOKEN_KEY`, and Razorpay test credentials in `.env`.
2. Apply all SQL files in `supabase/migrations/` to Supabase.
3. Seed Star policy wording with `npm.cmd run seed:policy` in PowerShell.
4. Start the Star mock, HDFC mock, and Fynish in three terminals.
5. Open `http://127.0.0.1:3000`, enter a name, choose an insurer, ask a question in English/Telugu/Hindi, then start a claim.
6. For a payment-trigger demo, use **Try a UPI payment alert**. Razorpay test mode uses simulated payments only. Configure a test-mode `payment.captured` webhook for return-after-close behavior.

Provider READMEs contain demo accounts. HDFC policy terms and clauses are synthetic and must stay labeled as demo data.

## Bricks

| # | Brick | Status | Done when |
|---|---|---|---|
| 0 | App foundation | Done | Next.js, TypeScript, Supabase, shared types, and rules are in place. |
| 1 | Policy and assessment | Implemented; end-to-end data setup pending | Star wording can be seeded; uploaded bills are scored, mapped to clauses, and given a provisional estimate. |
| 2 | Provider mock APIs | Done; private repos published | Independent Star and HDFC mocks provide login, account, policies, balance, claim filing, and status. |
| 3 | Provider connection | Implemented; database migration/setup pending | PKCE sign-in runs in an in-page modal, tokens stay server-side encrypted, and policy data loads. |
| 4 | Claim journey | Implemented; live setup pending | Welcome collects name/provider, user uploads documents, reviews assessment, and explicitly approves mock filing. |
| 5 | Insurance assistant | Implemented; Gemini chat smoke-checked | Gemini-compatible chat streams answers, matches English/Telugu/Hindi scripts, and uses source-linked public HDFC FAQs. `gemini-3.5-flash-lite` returned a short response; full conversational latency still needs a browser check. |
| 6 | Voice input | Implemented where browser speech recognition is available | User chooses English/Telugu/Hindi voice input, edits transcript, then sends it to the assistant. |
| 7 | Razorpay payment trigger | Implemented; migration and test credentials/webhook setup pending | Test Checkout creates a simulated payment, server verifies it, and a saved alert prompts a claim when Fynish reopens. |
| 8 | Sarvam language/voice layer | Planned after hackathon credits/key are available | Replace or augment language and speech paths with Sarvam Translate/Mayura, Saaras, or Bulbul after account access. |

## Product rules

- Never accept real insurer passwords or one-time codes. Mock portals accept seeded demo credentials only.
- Keep provider tokens encrypted on the server. Keep Razorpay keys and signatures on the server.
- Keep readiness score separate from the provisional estimate. Show policy sources and label synthetic wording.
- A model may read and explain; deterministic code validates amounts and policy-rule logic. Only the insurer decides the claim.
- Match the reply language and script to the user's message: English, Telugu script, Roman Telugu, Devanagari Hindi, or Roman Hindi.
- Keep all payment triggers explicitly test/demo unless connected through a consented bank-data partner.

## Setup still required

- Apply `0001_init.sql`, `0002_provider_connections.sql`, and `0003_demo_payment_signals.sql` in Supabase.
- Gemini credentials and model listing are valid. A short chat succeeded on `gemini-3.5-flash-lite`; verify full chat and bill-image extraction in the browser after applying migrations.
- Keep Razorpay credentials in test mode. For background notification after the browser closes, set the dashboard test webhook secret and expose `/api/payments/razorpay/webhook` over a reachable HTTPS URL.
- Browser voice recognition depends on browser support and microphone permission. A Sarvam STT/TTS integration needs the hackathon API key.
- This Razorpay demo records payments made through Fynish's test checkout. It cannot read arbitrary payments from a customer's bank or UPI app.
