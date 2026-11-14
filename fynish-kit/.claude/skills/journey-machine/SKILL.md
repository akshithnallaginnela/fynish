---
name: journey-machine
description: Use when adding, changing or debugging a state or transition in the Fynish journey state machine (src/journey). Covers the six states, transition rules, event logging and how to test a transition.
---

# Journey state machine

## States
`triggered → collecting → scoring → (collecting | confirmed) → submitted → tracking → (closed | escalated)`
Any state may go to `escalated` on a handoff trigger. There is no other way to change state.

## Shape
```ts
// src/journey/machine.ts
export type JourneyState = 'triggered'|'collecting'|'scoring'|'confirmed'|'submitted'|'tracking'|'closed'|'escalated';
export const transitions: Record<JourneyState, JourneyState[]> = {
  triggered: ['collecting','escalated'],
  collecting: ['scoring','escalated'],
  scoring: ['collecting','confirmed','escalated'],
  confirmed: ['submitted','escalated'],
  submitted: ['tracking','escalated'],
  tracking: ['closed','escalated'],
  closed: [],
  escalated: ['collecting'], // a human can hand it back
};
export async function transition(journeyId: string, to: JourneyState, reason: string, actor: 'agent'|'customer'|'system'|'human'): Promise<Journey>
```
`transition()` checks the table, writes the new state, and calls `appendEvent({kind:'transition', payload:{from,to,reason,actor}})` in the same database transaction. It throws `IllegalTransition` otherwise.

## Steps
One file per step in `src/journey/steps/`: `trigger.ts`, `collect.ts`, `score.ts`, `confirm.ts`, `submit.ts`, `track.ts`, `escalate.ts`. A step:
1. Loads the journey.
2. Does its work through interfaces (`LLMProvider`, `InsurerAdapter`, rules).
3. Calls `transition()` exactly once on success, or returns a `StepOutcome` of `wait` (needs customer input) without changing state.
4. Never renders UI; returns `AgentMessage[]` for the route to send.

## Adding or changing a state
1. Update `transitions` table and the `JourneyState` union in one commit.
2. Add/adjust the step file.
3. Tests in `src/journey/__tests__/machine.test.ts`: every allowed transition succeeds; at least one disallowed transition throws; the event row is written.
4. Update the state diagram in `docs/04-FRD.md` (one line).

## Handoff triggers (→ escalated)
Extraction confidence < 0.6 · insurer status `QUERY` · three failed submits · customer message matches /\b(human|agent|person|talk to someone)\b/i. Implement as `shouldEscalate(ctx): {yes:boolean, reason:string}` in `src/journey/escalation.ts`, tested with one case per trigger.

## Debugging
Read `/journey/[id]/log`. If the UI and state disagree, the log is the truth. Never fix a bad state by editing the row; add a transition with reason `manual_fix` so the log stays honest.
