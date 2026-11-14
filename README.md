# Fynish

Fynish helps people understand health insurance questions and prepare a claim. The demo includes Star Health and synthetic HDFC ERGO provider portals, a streamed insurance assistant, bill assessment, mock claim submission, and a Razorpay test payment trigger.

## Run the demo

Requires Node.js 26.

1. Install packages: `npm.cmd ci`.
2. Copy `.env.example` to `.env`. Set Supabase, the Gemini-compatible `LLM_*` endpoint, provider token encryption key, and Razorpay **test** credentials.
3. Apply `supabase/migrations/0001_init.sql`, `0002_provider_connections.sql`, and `0003_demo_payment_signals.sql` in Supabase SQL editor.
4. Seed the Star policy wording: `npm.cmd run seed:policy`.
5. Start three PowerShell terminals:

   ```powershell
   npm.cmd run provider:star
   npm.cmd run provider:hdfc
   npm.cmd run dev
   ```

6. Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Keep this host; provider demo sign-in opens in an in-page frame.

Use `ravi.star@demo.test` / `demo123` for Star Health and `ravi.hdfc@demo.test` / `123456` for HDFC ERGO. These are separate demo logins for the same fictional customer; no real insurer account or OTP is involved. The Star policy schedule and the HDFC ERGO policy are synthetic. HDFC ERGO terms do not describe real HDFC coverage.

## What works

- Welcome asks for the customer's name and insurer, then opens the provider-owned demo login. A test payment connection is optional and can be enabled later in transaction history.
- Provider APIs return the demo account, policies, balance, and claims. The claim page shows sum insured, used amount, and remaining balance. Mock balances update after filing and reset when the mock server restarts.
- Bill assessment extracts fields, scores readiness, cites available wording, and shows a provisional estimate. Filing requires explicit approval and submits to the mock provider.
- The homepage assistant streams answers about insurance, policies, claims, and related money questions, using the selected demo policy's cover and current balance when available. It follows English, Telugu, or Hindi and matches native or Roman script from the message. The microphone records up to 28 seconds and uses Sarvam speech-to-text after recording stops; replies and the claim summary can be read aloud with Sarvam text-to-speech.
- The assistant uses a small set of source-linked public HDFC ERGO FAQs for general answers. These do not override a user's exact policy schedule. The HDFC mock policy remains synthetic.
- Transaction history opens the test merchant checkout in a separate tab. A verified hospital test payment appears in history and prompts a claim check in an open Fynish tab; a grocery test payment appears in history without a hospital alert. The customer uploads the bill separately. The app polls for updates while open. For notifications after the checkout browser closes, configure a publicly reachable test-mode `payment.captured` webhook and `RAZORPAY_WEBHOOK_SECRET`.
- Synthetic upload samples are in `seed/demo/` and `public/demo/`. The ₹42,000 Apollo sample is fictional, visibly marked as a demo, and must not be used for a real claim.
- Recent chat messages are saved in browser storage on the current device. The claim review screen can prepare a factual message asking the insurer to explain its calculation and deductions.

## Configuration and limits

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are server-side database credentials. Apply all three SQL migrations before using login, uploads, or payment alerts.
- `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL` configure document extraction and chat. The example uses `gemini-3.5-flash-lite`; choose a model supported by the configured endpoint. The server keeps this configuration out of the user interface.
- `SARVAM_API_KEY` configures server-side speech-to-text, transliteration, and text-to-speech. The key is never sent to the browser.
- Keep `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in test mode. Fynish rejects live keys in the demo checkout.
- A Razorpay test payment demonstrates the trigger flow; it does not read every transaction from a person's bank or UPI app. The demo merchant category comes from a fixed local list, not a real bank merchant registry. Real transaction sharing needs an appropriate consented data integration. Test mode moves no real money.
- Upload the included synthetic samples or anonymized documents. Extraction accepts images and PDFs; scanned PDF support requires the configured Gemini service.
- `PROVIDER_TOKEN_KEY` encrypts provider tokens and demo session cookies. Never commit `.env`.

The provider mocks have separate private GitHub repos: [Star Health](https://github.com/akshithnallaginnela/fynish-star-health-mock) and [HDFC ERGO](https://github.com/akshithnallaginnela/fynish-hdfc-ergo-mock). Each provides `/oauth/authorize`, `/oauth/token`, `/api/me`, `/api/policies`, `/api/policies/:id`, `/api/policies/:id/balance`, `/api/claims`, and `/api/claims/:id`.

## Project docs

- [Implementation plan](fynish-kit/docs/06-IMPLEMENTATION-PLAN.md)
- [Demo script](fynish-kit/docs/08-DEMO-SCRIPT.md)
- [Provider flow ADR](docs/adr/0001-provider-connected-claim-flow.md)
- [Domain glossary](docs/GLOSSARY.md)
