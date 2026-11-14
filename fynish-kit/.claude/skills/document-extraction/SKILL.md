---
name: document-extraction
description: Use when touching the LLM provider, extraction prompts or schemas for hospital bills and discharge summaries (src/lib/llm). Covers schema-first extraction, PII masking, retries, fixtures and the demo cache switch.
---

# Document extraction

## Principle
The LLM fills a schema; it never free-writes data. Output is parsed with zod. If parsing fails, retry once with the validation error appended; on second failure mark `needs_review` and continue with partial data.

## Provider interface (`src/lib/llm/provider.ts`)
```ts
export interface LLMProvider {
  extract<T>(args: { images: Blob[]; schema: z.ZodType<T>; instructions: string; promptId: string }): Promise<{ data: T; confidence: number; usage: Usage }>;
  explain(args: { input: ExplainInput; language: Language; promptId: string }): Promise<{ text: string; usage: Usage }>;
}
```
Default implementation `anthropic.ts` uses the Messages API with image content blocks and a single tool whose input schema is the zod schema converted with `zod-to-json-schema`; `tool_choice` forces that tool. Confidence: if the tool returns a `confidence` field (0–1) use it; else 0.8 on first-try success, 0.6 after a retry.

## Schemas (`src/lib/llm/schemas.ts`)
```ts
export const HospitalBill = z.object({
  hospitalName: z.string(), patientName: z.string(),
  admissionDate: z.string().date(), dischargeDate: z.string().date(),
  roomType: z.string().nullable(), roomRentPerDayPaise: z.number().int().nullable(),
  totalAmountPaise: z.number().int(),
  lineItems: z.array(z.object({ label: z.string(), amountPaise: z.number().int() })).max(60),
  confidence: z.number().min(0).max(1),
});
export const DischargeSummary = z.object({
  diagnosis: z.string(), procedure: z.string().nullable(),
  admissionDate: z.string().date(), dischargeDate: z.string().date(),
  treatingDoctor: z.string().nullable(), confidence: z.number().min(0).max(1),
});
```
Money is paise (integer). Dates ISO `YYYY-MM-DD`. Unknown → `null`, never a guess.

## Prompts (`src/lib/llm/prompts/extract-bill.v1.ts`)
- State the document type and that the output must match the tool schema exactly.
- "If a field is not visible, return null. Do not infer."
- "Amounts in Indian rupees; convert to paise integers."
- "Room rent per day: look for 'Room Rent', 'Bed charges', 'Accommodation' and divide by number of days if a total is given; set null if unclear."
- Bump the version in the filename for any change; log `promptId` in the event.

## PII
Before any `explain()` call, replace `patientName` with initials and mask policy number to last 4. Raw images go only to `extract()`. Never log image bytes; log `imageSha256` and sizes.

## Fixtures and the demo cache
- `seed/fixtures/bill-01.jpg` + `bill-01.expected.json` (hand-checked once). Test: extracted ⊇ expected on key fields; amounts within ±1% tolerance.
- `DEMO_CACHE=1`: `anthropic.ts` is wrapped by `cached-provider.ts`, keyed by `imageSha256 + promptId`; cache lives in `seed/fixtures/cache/*.json`. Populate it the night before by running the extraction once with `DEMO_CACHE_WRITE=1`. This is the Wi-Fi insurance.

## Failure copy
Unreadable → "I couldn't read this one — could you send a clearer photo, with the whole page visible?" Never expose a stack trace or the word "model".
