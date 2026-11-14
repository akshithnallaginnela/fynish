// src/lib/types.ts — the shapes every brick builds against.
// Money is integer paise. Dates are ISO strings (YYYY-MM-DD) unless named *At (ISO datetime).
import { z } from 'zod';

// ───────────────────────── Journey ─────────────────────────
export type JourneyType = 'claim' | 'loan';
export type JourneyState =
  | 'triggered' | 'collecting' | 'scoring' | 'confirmed'
  | 'submitted' | 'tracking' | 'closed' | 'escalated';
export type Language = 'en' | 'te' | 'hi';

export interface Journey {
  id: string;
  type: JourneyType;
  state: JourneyState;
  customerId: string;
  policyId: string | null;
  language: Language;
  extracted: ExtractedData;
  score: number | null;
  scoreBreakdown: RuleResult[] | null;
  claimId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ───────────────────────── Events (append-only) ─────────────────────────
export type EventKind = 'transition' | 'llm_call' | 'rule_eval' | 'external_call' | 'user_action';
export interface JourneyEvent {
  id: string;
  journeyId: string;
  ts: string;
  kind: EventKind;
  payload: Record<string, unknown>;
}

// ───────────────────────── Payment signals ─────────────────────────
export const PaymentSignal = z.object({
  id: z.string(),
  ts: z.string().datetime(),
  customerId: z.string(),
  amountPaise: z.number().int().positive(),
  merchantName: z.string(),
  merchantCategory: z.enum(['HOSPITAL', 'CLINIC', 'DIAGNOSTIC', 'PHARMACY', 'GROCERY', 'FUEL', 'OTHER']),
  upiRef: z.string(),
});
export type PaymentSignal = z.infer<typeof PaymentSignal>;

export interface PaymentSignalSource {
  next(): Promise<PaymentSignal[]>;
}

// ───────────────────────── Documents & extraction ─────────────────────────
export type DocumentKind = 'receipt' | 'bill' | 'discharge_summary' | 'prescription' | 'id_proof' | 'other';

export const HospitalBill = z.object({
  hospitalName: z.string(),
  patientName: z.string(),
  admissionDate: z.string(),
  dischargeDate: z.string(),
  roomType: z.string().nullable(),
  roomRentPerDayPaise: z.number().int().nullable(),
  totalAmountPaise: z.number().int(),
  lineItems: z.array(z.object({ label: z.string(), amountPaise: z.number().int() })).max(60),
  confidence: z.number().min(0).max(1),
});
export type HospitalBill = z.infer<typeof HospitalBill>;

export const DischargeSummary = z.object({
  diagnosis: z.string(),
  procedure: z.string().nullable(),
  admissionDate: z.string(),
  dischargeDate: z.string(),
  treatingDoctor: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});
export type DischargeSummary = z.infer<typeof DischargeSummary>;

export interface ExtractedData {
  bill?: HospitalBill;
  dischargeSummary?: DischargeSummary;
  receipt?: { amountPaise: number; merchantName: string; paidAt: string; upiRef: string };
  needsReview?: DocumentKind[];
}

export interface JourneyDocument {
  id: string;
  journeyId: string;
  kind: DocumentKind;
  storagePath: string;
  sha256: string;
  extracted: unknown | null;
  createdAt: string;
}

// ───────────────────────── Policy ─────────────────────────
export interface PolicyProfile {
  id: string;
  insurer: string;
  product: string;
  wordingVersion: string;
  sumInsuredPaise: number;
  policyStart: string;
  limits: {
    roomRentPerDayPaise?: number;
    roomRentPctOfSumInsured?: number; // e.g. 1 → 1% of SI per day
    intimationDays?: number;
    waitingPeriods: Array<{ code: string; label: string; months: number; clauseRef: string }>;
  };
  clauses: { roomRent?: string; waitingPeriods?: string; documents?: string; intimation?: string; sumInsured?: string };
}

export interface PolicyChunk {
  id: string;
  policyId: string;
  clauseRef: string | null;
  page: number;
  text: string;
}

export interface ClauseLookup {
  clauseRef: string;
  page: number;
  text: string;          // full chunk
  highlight?: [number, number]; // char range within text to mark
}

// ───────────────────────── Rules & score ─────────────────────────
export type Severity = 'blocker' | 'major' | 'minor';

export interface RuleContext {
  extracted: ExtractedData;
  documents: Pick<JourneyDocument, 'kind' | 'extracted'>[];
  policy: PolicyProfile;
  today: string; // ISO date, injected for determinism
}

export interface RuleResult {
  ruleId: string;
  passed: boolean | null; // null = could not evaluate
  deduction: number;
  reason: string;         // customer-facing, one sentence
  clauseRefs: string[];
  whatToDo?: string;
  severity: Severity;
}

export interface Rule {
  id: `R-${string}`;
  title: string;
  severity: Severity;
  evaluate(ctx: RuleContext): RuleResult;
}

export interface ScoreResult {
  score: number;              // 0–100
  breakdown: RuleResult[];    // all rules, passed and failed
  readyToSubmit: boolean;     // score >= 85 && no failed blocker
  computedAt: string;
}

// ───────────────────────── Insurer ─────────────────────────
export type ClaimStatusCode = 'RECEIVED' | 'UNDER_REVIEW' | 'QUERY' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface ClaimPayload {
  journeyId: string;
  policyId: string;
  claimedAmountPaise: number;
  admissionDate: string;
  dischargeDate: string;
  diagnosis: string;
  documents: Array<{ kind: DocumentKind; sha256: string }>;
}

export interface ClaimStatus {
  claimId: string;
  code: ClaimStatusCode;
  message?: string;
  approvedAmountPaise?: number;
  updatedAt: string;
}

export interface InsurerAdapter {
  submit(claim: ClaimPayload): Promise<{ claimId: string }>;
  status(claimId: string): Promise<ClaimStatus>;
}

// ───────────────────────── LLM ─────────────────────────
export interface Usage { inputTokens: number; outputTokens: number; latencyMs: number; model: string }

export interface ExplainInput {
  journey: Pick<Journey, 'id' | 'type'>;
  extracted: ExtractedData;      // PII already masked
  score: ScoreResult;
  policy: Pick<PolicyProfile, 'insurer' | 'product'>;
}

export interface LLMProvider {
  extract<T>(args: { images: Blob[]; schema: z.ZodType<T>; instructions: string; promptId: string }): Promise<{ data: T; confidence: number; usage: Usage }>;
  explain(args: { input: ExplainInput; language: Language; promptId: string }): Promise<{ text: string; usage: Usage }>;
}

// ───────────────────────── Chat ─────────────────────────
export type MessageRole = 'agent' | 'customer' | 'system';
export interface AgentMessage {
  role: MessageRole;
  text?: string;
  card?: { type: 'trigger' | 'score' | 'summary' | 'status' | 'handoff'; data: unknown };
  buttons?: Array<{ label: string; action: string }>;
  attachments?: Array<{ documentId: string; kind: DocumentKind }>;
}

// ───────────────────────── Handoff ─────────────────────────
export interface CaseBrief {
  journeyId: string;
  generatedAt: string;
  journeySummary: string;
  documents: Array<{ kind: DocumentKind; received: boolean }>;
  scoreHistory: Array<{ at: string; score: number }>;
  openQuestion: string;
  suggestedNextStep: string;
}
