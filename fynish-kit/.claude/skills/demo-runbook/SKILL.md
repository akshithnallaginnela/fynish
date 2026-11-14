---
name: demo-runbook
description: Use in the last two hours before the Fynish demo and during it. Seeding, cache warm-up, reset between runs, the exact click path, failure fallbacks and the backup video. Also use when writing scripts/seed-demo.ts.
---

# Demo runbook

## T-120 min — freeze
- `git tag demo-freeze`. No feature work after this. Fixes only for things that break the click path.
- Confirm `npm test` green and `npm run build` succeeds (catches type errors the dev server hides).

## T-90 — seed and cache
- `npm run seed:policy` → prints clause refs; confirm `4.2`, `6.1`, `7.1`, `7.3` (or whatever `profile.json` names) are present.
- `DEMO_CACHE_WRITE=1 npm run seed:demo` → runs extraction once on `bill-01.jpg` and `discharge-01.jpg`, writes `seed/fixtures/cache/`.
- Verify `DEMO_CACHE=1 npm run dev` completes the full path with Wi-Fi **off**.

## T-60 — rehearse ×3
Follow `docs/08-DEMO-SCRIPT.md`. Time each run. Reset with `npm run seed:demo` between runs (truncates `journeys`, `events`, `documents`, `mock_claims`; reloads feed). If over 4:00, cut the audit-log view, never the clause panel.

## T-30 — backup video
Screen-record one clean run with narration (QuickTime / OBS / phone pointed at the screen as last resort). Save to laptop *and* phone. Check it plays with sound.

## T-10 — environment
Browser zoom 125%, one tab, notifications off, laptop plugged in, hotspot on and tested, `DEMO_CACHE=1` set if venue Wi-Fi is doubtful, `seed:demo` run once more, `/` open with the empty chat.

## The click path (memorise)
1. **Run payment feed** button (dev-only, top-right) → trigger card.
2. **Yes, file it** → upload `bill-01.jpg` → agent asks for discharge summary.
3. Score card **72** → tap **−18** → clause panel → close → tap **−10** → clause 4.2 → close.
4. Upload `discharge-01.jpg` → ring **72 → 94** → "Ready to submit".
5. Summary card (Telugu/Hindi) → **Confirm & submit** → claim ID.
6. **Advance insurer status** ×2 → "They have a question" → handoff brief opens.
7. `/journey/[id]/log` for two seconds → close.

## `scripts/seed-demo.ts` must
- Truncate the four mutable tables; keep `policies` and `policy_chunks`.
- Insert the seeded customer and policy-on-file.
- Copy `seed/mock-upi-feed.json` into the feed location the adapter reads.
- Print the journey URL it expects after the first trigger.
- Be idempotent: running it twice is fine.

## Fallbacks
| Symptom | Do |
|---|---|
| Extraction slow/failing | "I'll use the cached read so we don't wait on the network." Flip `DEMO_CACHE=1` (env toggle route `/api/dev/cache?on=1`), re-upload. |
| Score card doesn't appear | Reload; state is in the DB, the chat re-renders from events. |
| Anything else for > 20 s | Play the backup video, narrate over it, keep eye contact. |
Apologise once at most. Judges remember composure more than the bug.

## After the demo
Push `demo-freeze` tag and the final commit. Write three lines in `DECISIONS.md`: what broke, what the judges asked, what to build first next.
