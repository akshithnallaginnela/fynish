# Design Spec — Fynish

**Reader** Whoever builds the front end (you, with Claude Code and the `ui-build` skill)
**Principle** A financial product people trust looks calm, legible and unhurried. No gradients, no glassmorphism, no animated backgrounds. The only thing that should move is the score.

---

## 1. Design direction

**Mood:** a quiet, competent assistant. Think bank statement clarity with chat warmth.
**Reference points:** WhatsApp's familiarity for the chat, a credit-score ring for the number, a PDF viewer's highlight for the clause.
**Anti-references:** dashboards with twelve charts; chatbots with a cartoon avatar; neon fintech.

## 2. Tokens

Same palette as the pitch deck, so the demo and the slides read as one product.

```css
:root {
  /* surfaces */
  --bg:            #F5F7FB;   /* page */
  --bg-2:          #EAEEF6;   /* alternate sections */
  --card:          #FDFDFE;
  --ink:           #0E1B33;   /* headings, primary text */
  --ink-2:         #45506A;   /* body */
  --ink-3:         #6A7590;   /* captions, timestamps */
  --line:          #D9DFEC;

  /* dark (agent bubbles, score panel header) */
  --navy:          #0E1B33;
  --navy-2:        #152743;
  --on-navy:       #F5F7FB;
  --on-navy-2:     #C3CCE0;

  /* accents */
  --teal:          #0B7458;   /* on light: text, icons, borders */
  --teal-bright:   #2BD3A3;   /* on dark only */
  --teal-tint:     #DDF4EC;   /* highlight fill, success background */
  --amber:         #F5B041;   /* warnings, mid scores (on dark) */
  --amber-ink:     #8A5A00;   /* amber text on light */
  --amber-tint:    #FFF1D6;
  --red-ink:       #A32D2D;   /* blockers */
  --red-tint:      #FBE3E3;

  /* type */
  --font-display:  "Space Grotesk", system-ui, sans-serif;
  --font-text:     "DM Sans", system-ui, sans-serif;

  /* scale (px) */
  --t-display: 40; --t-h1: 28; --t-h2: 20; --t-body: 16; --t-small: 13;

  /* shape */
  --radius-card: 16px; --radius-bubble: 18px; --radius-pill: 999px;
  --shadow-card: 0 1px 2px rgba(14,27,51,.06), 0 8px 24px rgba(14,27,51,.06);
}
```

**Score colour rule:** ≥ 85 teal · 60–84 amber · < 60 red. Colour never speaks alone: the number and the label ("Ready to submit" / "Needs 2 fixes" / "Will likely be rejected") always accompany it.

**Contrast:** all text ≥ 4.5:1 on its background. `--teal-bright` is never used for text on light surfaces.

## 3. Screens (scribbles)

Low-fidelity on purpose. Build from these, not from a Dribbble shot.

### S1 — Chat (the only screen the judge sees for 80% of the demo)

```
┌──────────────────────────────────────────────────────────────┐
│ ● Fynish            Claim · Apollo Hospitals     [EN ▾] [≡]   │  header: product, journey label, language, menu
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ system ─────────────────────────────────────────────┐    │  trigger card (not a bubble): receipt thumbnail,
│  │ 🧾 ₹42,000 · Apollo Hospitals · UPI · 11 Nov, 18:42   │    │  amount, merchant, policy on file
│  │ Policy: Star Health Family Optima · ****4471          │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─ agent (navy) ───────────────────────────────┐            │
│  │ Looks like a hospital bill. You hold a health │            │
│  │ policy — want me to file the claim? I already │            │
│  │ have the receipt.                             │            │
│  │  [ Yes, file it ]   [ Not now ]               │            │
│  └───────────────────────────────────────────────┘            │
│                                                              │
│            ┌─ customer (light, right) ──────────┐            │
│            │ yes                                 │            │
│            └─────────────────────────────────────┘            │
│            ┌────────────┐ ┌────────────┐                      │  image thumbnails as customer messages
│            │ bill.jpg   │ │ summary.jpg│                      │
│            └────────────┘ └────────────┘                      │
│                                                              │
│  ┌─ agent ───────────────────────────────────────┐            │
│  │ Got the bill. One thing missing: the discharge │            │
│  │ summary — the page with diagnosis and dates.   │            │
│  └────────────────────────────────────────────────┘            │
│                                                              │
│  ┌─ SCORE CARD (inline, full width) ────────────────────┐    │  see S2
│  └───────────────────────────────────────────────────────┘    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ [📎] [🎤]  Type or talk…                            [Send ▶] │  composer
└──────────────────────────────────────────────────────────────┘
```

Rules: agent bubbles navy with `--on-navy` text; customer bubbles `--card` with border; system cards neutral with a left teal rule; max bubble width 72%; timestamps in `--ink-3` 13px on hover/below groups.

### S2 — Score card (inline in chat; this is the demo moment)

```
┌───────────────────────────────────────────────────────────────┐
│  Claim Readiness                                              │
│                                                               │
│      ╭───────╮     Needs 2 fixes                              │
│      │  72   │     Fix these before you submit:               │
│      ╰───────╯                                                │
│   ring, animated                                              │
│   from previous value                                         │
│                                                               │
│  ▼ −18  Discharge summary missing                 clause 7.3  │  deduction row: points, reason, clause chip
│  ▼ −10  Room rent ₹8,000/day above your 1% cap     clause 4.2 │
│  ✓   0  Admission within policy period                        │  passed rules collapsed under "5 checks passed"
│  ▸ 5 checks passed                                            │
│                                                               │
│  [ Send missing page ]                      [ Submit anyway ] │  secondary action is deliberately quiet
└───────────────────────────────────────────────────────────────┘
```

Behaviour: ring animates 0.6 s between values; deduction rows sorted by points; tapping a row opens S3 as a right-side sheet (desktop) or bottom sheet (mobile).

### S3 — Clause panel

```
┌─ Clause 4.2 · Room rent limit ─────────────────────── [×] ──┐
│                                                              │
│ Why this matters                                             │
│ Your room cost ₹8,000/day. This policy caps room rent at 1%  │
│ of sum insured per day (₹5,000). The insurer may reduce the  │
│ payout proportionally.                                       │
│                                                              │
│ What the policy says                     page 14             │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 4.2 Room Rent: … the Company's liability for room rent   │ │  source text, matched span highlighted
│ │ shall be limited to ▌1% of the Sum Insured per day▐ …    │ │  in --teal-tint
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ What to do                                                   │
│ Nothing to send — but expect ₹9,000 less. Want me to show    │
│ the likely payout?                                           │
└──────────────────────────────────────────────────────────────┘
```

### S4 — Summary & confirm card (inline)

Five lines, numbered, in the chosen language; amounts in `--font-display` weight 600; two buttons: **Confirm & submit** (teal fill) and **Fix first** (ghost). Under the buttons, 13px: *"Nothing is sent until you confirm."*

### S5 — Status card (inline, persistent at top after submit)

Claim ID · plain-language status · a 5-step progress line (Filed → Received → Being checked → Decision → Paid) · last updated time.

### S6 — Handoff brief (`/handoff/[id]`, internal)

Plain document layout: header (journey, customer initials, policy), then five sections — Summary, Documents, Score history (small table), Open question, Suggested next step. Print-friendly. No chat chrome.

### S7 — Audit log (`/journey/[id]/log`, internal)

Monospace-ish table: time · kind (coloured chip) · summary · expandable JSON. This is the "we are not vibecoded" screen; it should look like infrastructure.

## 4. Components and where to get them

Base: **shadcn/ui** (Button, Card, Sheet, Dialog, Badge, Progress, Tabs, Textarea, ScrollArea, Tooltip). Install only what is used.

Reference components to borrow from **21st.dev** (search these terms; adapt to tokens, do not paste with their colours):

| Need | 21st.dev search | Notes |
|---|---|---|
| Chat message list + composer | "chat", "ai chat input", "message list" | Keep the composer single-line with attach and mic icons; expand on focus |
| Animated score ring | "circular progress", "radial progress", "gauge" | Replace stroke colours with the score colour rule; animate value, not colour |
| Deduction rows | "accordion list", "checklist" | Rows are buttons, full-width, 44px min height |
| Right-side sheet | shadcn `Sheet` | For S3 on desktop |
| Status stepper | "stepper", "timeline horizontal" | Five steps, current step filled teal |
| File drop / thumbnails | "file upload", "image upload dropzone" | Thumbnails 96×96, rounded 12px |
| Highlighted text block | none needed | `<mark>` styled with `--teal-tint` and no underline |

Icons: **lucide-react** only. Sizes 16/20/24.

## 5. Motion

- Score ring: 600 ms ease-out on value change. Nothing else animates except standard sheet/dialog transitions.
- New agent message: fade-in 150 ms. No typing dots longer than 1.5 s; show a "Reading your bill…" status line instead for LLM waits.

## 6. Copy rules (UX writing)

- Agent speaks in first person, short sentences, no jargon. "Discharge summary — the page with diagnosis and dates," not "Please furnish discharge documentation."
- Every ask names exactly one thing.
- Numbers are always rupees with the ₹ sign and Indian grouping (₹42,000; ₹1,20,000).
- Never say "AI" or "model" to the customer. Say "I".
- Status in human words; see FRD F8 mapping.

## 7. Responsive

Design mobile-first at 390px; the demo is shown on a laptop at ~1280px with the chat centred at max-width 720px and the clause sheet opening to the right. Nothing requires hover.

## 8. Accessibility

Focus rings visible (2px `--teal`); all buttons have text or `aria-label`; score ring has `aria-valuenow` and a text label; colour never the only signal; minimum 16px body text.

## 9. What not to build

No landing page. No login (seeded customer). No dark mode toggle. No settings. Every hour on those is an hour not on the score.
