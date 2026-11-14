# Fynish demo walkthrough

## Before the demo

1. Copy `.env.example` to `.env` and configure Supabase, the Gemini-compatible endpoint, provider token encryption, and Razorpay test keys.
2. Apply `supabase/migrations/0001_init.sql`, `0002_provider_connections.sql`, and `0003_demo_payment_signals.sql`.
3. Run `npm.cmd run seed:policy` to load the Star policy wording.
4. Start `npm.cmd run provider:star`, `npm.cmd run provider:hdfc`, and `npm.cmd run dev` in separate terminals.
5. Open `http://127.0.0.1:3000`. Choose a demo account from the provider README. Use `seed/demo/apollo-demo-bill.pdf` and `seed/demo/apollo-demo-discharge-summary.pdf` for the synthetic claim.

## Four-minute flow

**0:00 — Welcome and assistant**

Ask a policy question in the language and script you want to show. The assistant streams a response. Mention that the page can also take English, Telugu, or Hindi voice input when the browser supports it.

**0:35 — Connect the provider**

Select **Start a claim**. Pick Star Health or HDFC ERGO. The provider's clearly labeled demo login opens in a page modal. Sign in with its seeded demo credentials.

Explain: “This is a provider API mock for the demo. It returns a test account, policy, balance, and claim status. The HDFC policy wording is synthetic.”

**1:05 — Show policy balance**

Point out sum insured, claimed so far, and remaining balance. These values come from the selected mock policy. The mock updates its remaining balance after an accepted demo claim and resets when its server restarts.

**1:25 — Upload and review**

Upload a sample hospital bill and, if available, a discharge summary. Choose **Check this claim**. Show extracted bill details, readiness score, covered/review items, provisional estimate, and any available clause text. Explain that the estimate is not a promise of insurer payment.

If you first made a Razorpay test payment, the claim page can show its payment record and compare hospital name and amount with the bill. Use Razorpay's test details; no real funds move.

**2:30 — Approve and file**

Review the checklist, tick the approval box, and choose **Approve and file demo claim**. Show the mock claim ID and status. Point out that the mock policy balance updates after filing.

**3:15 — Close**

Summarize: “Fynish extracts the bill, checks it against available policy rules, shows a provisional claim estimate, and files only after the user approves. The provider APIs and payment are test mocks.”

## Optional payment trigger

On the homepage, use **Try a UPI payment alert** and **Try payment** with Razorpay test mode. After capture, the payment alert appears on the page. Choose **Check claim** to carry its order ID into the claim flow. This demonstrates only payments made through Fynish's test checkout; it does not monitor a user's bank or other UPI apps.

For webhook recovery after the browser closes, configure `RAZORPAY_WEBHOOK_SECRET` and a reachable HTTPS URL for `/api/payments/razorpay/webhook`. This setup is optional for the live browser checkout demo.

## If a dependency fails

- Provider login fails: confirm both mock servers and Fynish use the `127.0.0.1` URLs shown above.
- Policy or upload requests fail: confirm all three Supabase migrations are applied and the service-role configuration is correct.
- Chat or extraction fails: confirm the configured model endpoint and credentials respond.
- Payment checkout fails: keep the payment portion optional and continue with provider login and claim review.

Do not claim that a test payment reads unrelated bank activity, that the estimate guarantees reimbursement, or that synthetic HDFC terms are official coverage.
