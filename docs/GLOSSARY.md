# Fynish domain glossary

| Term | Meaning |
| --- | --- |
| Insurer | Company selected by the customer, such as Star Health or HDFC ERGO. In this demo, its portal and APIs are mocks. |
| Provider mock | Independent demo app that simulates an insurer's login and account APIs. It accepts only seeded demo accounts. |
| Provider account | Customer identity inside one provider mock. One account may have several policies. |
| Provider connection | Fynish's server-side link to a provider account, including token expiry and access scope. |
| Access token | Short-lived credential used by the Fynish server to call protected provider mock APIs. It is never shown to browser code. |
| Policy product | The insurer's general insurance plan and its published wording. |
| Policy schedule | Customer-specific values, such as policy number, insured people, coverage dates, sum insured, and co-pay. |
| Policy wording | Text that defines benefits, exclusions, limits, and conditions. Clause citations point here. |
| Remaining balance | Provider-reported coverage remaining under a policy. It is not the amount payable for a new claim. |
| Bill line item | A charge extracted from a hospital bill. It must be checked against policy terms before classification. |
| Clause citation | Reference to the exact policy wording used to explain an assessment. |
| Readiness score | Existing 0–100 measure of whether a claim has enough valid information and documents to submit. It is not a payout prediction. |
| Payable estimate | Separate, provisional rupee calculation from recognized bill charges, policy limits, co-pay, and remaining balance. The demo withholds the amount when key details need review. |
| Claim | Customer-approved submission sent to a provider mock. |
