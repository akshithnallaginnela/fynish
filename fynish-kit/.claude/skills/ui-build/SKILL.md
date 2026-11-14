---
name: ui-build
description: Use when building or changing any Fynish screen or component (src/components, src/app). Enforces the design tokens, the seven screens in docs/07-DESIGN.md, shadcn/ui + 21st.dev references, copy rules and the "what not to build" list.
---

# UI build

## Read first
`docs/07-DESIGN.md` — tokens, scribbles S1–S7, component sources, copy rules. Do not design from memory of other fintech apps.

## Setup (once)
- Tailwind with CSS variables from the token block wired into `tailwind.config.ts` (`colors: { bg: 'var(--bg)', ink: 'var(--ink)', ... }`).
- Fonts: Space Grotesk (display) and DM Sans (text) via `next/font/google`.
- shadcn/ui: install only `button card sheet dialog badge progress textarea scroll-area tooltip`.
- Icons: `lucide-react` only.

## Component list and ownership
| Component | File | Notes |
|---|---|---|
| `ChatShell` | `components/chat/chat-shell.tsx` | header, scroll area, composer; max-width 720px |
| `MessageBubble` | `components/chat/message-bubble.tsx` | `role: 'agent'|'customer'|'system'`; agent navy, customer card, system left-rule |
| `Composer` | `components/chat/composer.tsx` | text, attach, mic (stretch), send; disabled while agent is working |
| `TriggerCard` | `components/cards/trigger-card.tsx` | receipt thumb, amount, merchant, policy masked |
| `ScoreCard` | `components/score/score-card.tsx` | ring + deductions + passed group + actions |
| `ScoreRing` | `components/score/score-ring.tsx` | SVG, animates `value` 600ms; `aria-valuenow`; colour by rule ≥85 teal / 60–84 amber / <60 red |
| `DeductionRow` | `components/score/deduction-row.tsx` | button; points, reason, clause chip; opens `ClausePanel` |
| `ClausePanel` | `components/score/clause-panel.tsx` | Sheet; why / source text with `<mark>` / what to do |
| `SummaryCard` | `components/cards/summary-card.tsx` | five numbered lines; Confirm (teal) + Fix first (ghost); footnote |
| `StatusCard` | `components/cards/status-card.tsx` | claim id, plain status, 5-step stepper |
| `HandoffBrief` | `app/handoff/[id]/page.tsx` | print-friendly document |
| `AuditLog` | `app/journey/[id]/log/page.tsx` | table with kind chips, expandable JSON |

## Borrowing from 21st.dev
Search terms per component are in `docs/07-DESIGN.md` §4. When adapting a 21st.dev component: strip its colours and radii, map to tokens, remove animations other than the score ring, keep accessibility attributes. Credit nothing in UI; note the source in a code comment.

## Rules
- No hex literals in components. No inline gradients. No glass effects.
- Every interactive element ≥ 44px tall on mobile; visible focus ring.
- Colour never alone: score ring always has number + label; status always has text.
- Copy in first person, one ask per agent message; never "AI"/"model"; rupees with ₹ and Indian grouping (`formatINR(paise)` in `lib/format.ts`).
- Loading: a status line ("Reading your bill…"), not a spinner, for LLM waits.
- Mobile-first at 390px; demo at 1280px with chat centred.

## Do not build
Landing page, login, settings, dark mode, admin console, animations beyond the ring and sheet transitions. If asked, point to `docs/07-DESIGN.md` §9 and move on.

## Done check for any screen
Matches its scribble; uses tokens; keyboard reachable; copy follows rules; no console errors; renders at 390px and 1280px.
