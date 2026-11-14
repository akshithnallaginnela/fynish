# ADR 0001: Provider-connected claim flow

Status: Accepted for the demo; GitHub publication pending account access  
Date: 2026-11-13

## Context

The original demo starts from a mock UPI payment. The new flow starts when a customer identifies their health insurer. UPI signals are deferred. The current app has a Star Health policy reference, clause lookup, and a readiness score. The provider connection, token storage, bill extraction, and estimate are being added for this flow.

## Proposed flow

1. Ask which insurer the customer uses. A policy number entered here is an unverified hint.
2. Open that insurer's **clearly labeled mock provider** login in a popup on the provider mock's own origin. Use seeded demo accounts only.
3. The provider mock returns a one-time authorization code. Fynish exchanges it on the server and stores the resulting access token, expiry, provider, and account link in the database. Fynish never receives the demo password.
4. Fynish's server uses the token to fetch account details, available policies, the selected policy's schedule and benefits, and remaining balance. If the account has several policies, the customer selects one after the fetch.
5. The customer uploads a hospital bill and supporting documents. Extraction turns bill charges and dates into structured data.
6. Deterministic logic compares extracted charges and claim details with the selected policy's terms. It shows covered, excluded, and uncertain items, applicable clauses, a readiness score, and a provisional payable estimate when the available terms support one.
7. The customer approves the reviewed claim. Fynish calls the mock provider's claim API and shows the returned claim ID and status.

Policy clauses live in policy wording, not in the bill. Bill extraction finds charges; the assessment maps those charges to policy terms and cites the wording.

## System boundaries

- Fynish: customer session, provider connection, document handling, assessment, and claim review.
- Star Health mock: independent demo login and token-protected account, policy, balance, and claim APIs.
- HDFC ERGO mock: same contract, independent demo login and a synthetic policy patterned on the Star demo structure. Its terms must be labeled as invented demo data.
- Each mock is a separate GitHub repository and origin. Neither represents an official insurer integration.

## Domain model

| Record | Owner | Key facts |
| --- | --- | --- |
| Provider account | Provider mock | Demo identity and its available policies. |
| Provider connection | Fynish | Customer session, provider, external account ID, encrypted access token, scope, expiry, disconnect state. |
| Policy instance | Provider mock; snapshot in Fynish | Provider-issued policy ID and number, covered people, dates, limits, co-pay, and remaining balance. A customer may have more than one. |
| Policy wording | Fynish reference data | Product and version, clause text, page, source document. |
| Claim journey | Fynish | Selected policy instance, documents, state, and customer approval. |
| Assessment | Fynish | Readiness score, rule results, any payable estimate, and the exact policy snapshot used. |
| Claim submission | Provider mock; ID and status in Fynish | Sent only after explicit approval. |

The customer selects an insurer before login. Fynish verifies their policy list after connecting; it cannot trust a typed policy number as proof of cover. Keep the policy snapshot and fetch time with the assessment so later balance changes do not silently rewrite an earlier explanation.

The existing `policies.id` identifies a wording product; it must not double as the provider-issued policy instance ID. Add a separate customer-policy record or snapshot and link the journey to both IDs. The current onboarding flag lives only in `localStorage`, so Fynish also needs a minimal server session before it can bind a provider connection to a customer.

The Fynish server owns provider API calls. Browser code never receives a provider access token. The proposed authorization-code flow uses transaction-specific `state` and PKCE. Store tokens encrypted on the server, with expiry and a way to disconnect. Never log tokens or place them in URLs. This matches the backend-for-frontend guidance in [RFC 10017](https://www.rfc-editor.org/rfc/rfc10017.html) and the authorization-code guidance in [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html).

## Decisions recorded

- Login opens a provider-owned demo popup, using only test accounts.
- The result shows readiness, covered items, and a provisional rupee estimate. Uncertain items remain marked for review; the estimate does not imply insurer approval.
- The HDFC ERGO mock uses a synthetic demo policy patterned on the Star demo structure, with its own clearly marked demo clauses.
- Explicit customer approval precedes submission to the mock insurer API.
- Publish the two provider mocks as separate GitHub repositories. Local repositories are prepared first; publication waits for working GitHub access.

## Implementation order

1. Define one small mock provider API contract and create the two independent provider repositories.
2. Add a demo customer session, provider connection table, popup callback, token exchange, and server-side policy fetch to Fynish.
3. Add upload and document extraction.
4. Add policy-aware assessment, clause display, covered-item classification, and a provisional payable estimate.
5. Add approval and mock filing.

The existing UPI feed, payment scripts, and trigger plan stay deferred.
