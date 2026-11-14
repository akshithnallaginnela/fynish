"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import Mark from "@/components/mark";
import Wordmark from "@/components/wordmark";
import { VoicePlayback } from "@/components/voice-controls";
import type { HospitalBill, RuleResult } from "@/lib/types";
import { ONBOARDING_KEY } from "@/lib/onboarding";

type Provider = "star" | "hdfc-ergo";
type Policy = {
  id: string;
  wordingId: string;
  provider: Provider;
  product: string;
  policyNumberMasked: string;
  status: string;
  sumInsuredPaise?: number;
  policyStart?: string;
  coPayPct?: number;
  insuredPeople?: Array<{ name: string; relationship: string }>;
};
type Session = {
  connected: boolean;
  provider?: Provider;
  account?: { id: string; name: string; email: string };
  policies?: Policy[];
  selectedPolicyId?: string;
  selectedPolicy?: Policy;
  balance?: { policyId: string; remainingBalancePaise: number; asOf: string };
};
type PaymentSignal = { orderId: string; hospitalName: string; amountPaise: number; paymentId: string | null; method: string | null; paidAt: string | null; seen: boolean };
type Analysis = {
  journeyId: string;
  bill: HospitalBill;
  readiness: { score: number; breakdown: RuleResult[]; readyToSubmit: boolean };
  amountSummary: {
    claimedAmountPaise: number;
    balanceCapPaise: number;
    estimatedPayablePaise: number | null;
    estimateUnavailableReason?: string;
    items: Array<{ label: string; amountPaise: number; status: "covered" | "excluded" | "review"; reason: string; clauseRef?: string }>;
  };
  citations: Array<{ clauseRef: string; page: number | null; text: string | null; source: string }>;
  warnings: string[];
  paymentCheck?: "matched" | "amount_mismatch" | "hospital_mismatch";
};

const names: Record<Provider, string> = { star: "Star Health", "hdfc-ergo": "HDFC ERGO" };
const rupees = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
const subscribeToProfile = (callback: () => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};
const savedProvider = (): Provider => {
  try {
    const profile = JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? "null") as { provider?: string } | null;
    return profile?.provider === "hdfc-ergo" ? "hdfc-ergo" : "star";
  } catch { return "star"; }
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || body.message || `Request failed (${response.status})`);
  return body as T;
}

function Step({ number, title, children, embedded }: { number: number; title: string; children: ReactNode; embedded?: boolean }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-[0_4px_0_#e8e2d1] sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        {!embedded && <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-tint text-sm font-extrabold text-blue">{number}</span>}
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function ClaimFlow({ embedded = false, paymentOrderId: suppliedPaymentOrderId, changeProvider = false, initialJourneyId, onAssessment }: { embedded?: boolean; paymentOrderId?: string; changeProvider?: boolean; initialJourneyId?: string; onAssessment?: (journeyId: string) => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const profileProvider = useSyncExternalStore<Provider>(subscribeToProfile, savedProvider, () => "star");
  const [manualProvider, setManualProvider] = useState<Provider | null>(null);
  const provider = session?.provider ?? manualProvider ?? profileProvider;
  const changeProviderFromUrl = useSyncExternalStore(subscribeToProfile, () => new URLSearchParams(window.location.search).has("changeProvider"), () => false);
  const [changingProvider, setChangingProvider] = useState(changeProvider);
  const changeProviderRequested = embedded ? changingProvider : changeProviderFromUrl;
  const [bill, setBill] = useState<File | null>(null);
  const [discharge, setDischarge] = useState<File | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [approved, setApproved] = useState(false);
  const [submission, setSubmission] = useState<{ claimId: string; status: string } | null>(null);
  const [paymentSignal, setPaymentSignal] = useState<PaymentSignal | null>(null);
  const [providerLoginUrl, setProviderLoginUrl] = useState("");
  const [busy, setBusy] = useState<"connect" | "disconnect" | "policy" | "analyze" | "submit" | null>(null);
  const [error, setError] = useState("");
  const loginFrame = useRef<HTMLIFrameElement>(null);

  const refreshSession = useCallback(async () => {
    const data = await requestJson<Session>("/api/provider/session");
    setSession(data);
    if (data.connected && data.provider) {
      try {
        const profile = JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? "{}");
        localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ ...profile, provider: data.provider }));
      } catch { /* The connection remains available for this session. */ }
    }
  }, []);

  useEffect(() => {
    let active = true;
    const connectionFailed = new URLSearchParams(window.location.search).has("connection_error");
    requestJson<Session>("/api/provider/session").then((data) => {
      if (!active) return;
      setSession(data);
      if (connectionFailed) setError("Provider sign-in did not finish. Try connecting again.");
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load your connection.");
    });
    const paymentOrderId = suppliedPaymentOrderId || new URLSearchParams(window.location.search).get("paymentOrderId");
    if (paymentOrderId) requestJson<{ signals: PaymentSignal[] }>(`/api/payment-feed?orderId=${encodeURIComponent(paymentOrderId)}`).then((data) => {
      if (active && data.signals[0]) setPaymentSignal(data.signals[0]);
    }).catch(() => {});
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== loginFrame.current?.contentWindow) return;
      if (event.data?.type === "fynish-provider-error") {
        setProviderLoginUrl("");
        setError("Provider sign-in did not finish. Try connecting again.");
        return;
      }
      if (event.data?.type !== "fynish-provider-connected") return;
      setProviderLoginUrl("");
      setError("");
      refreshSession().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load your policies."));
    };
    window.addEventListener("message", onMessage);
    return () => { active = false; window.removeEventListener("message", onMessage); };
  }, [refreshSession, suppliedPaymentOrderId]);

  useEffect(() => {
    if (!initialJourneyId) return;
    let active = true;
    requestJson<Analysis & { submission?: { claimId: string; status: string } }>(`/api/claim/review?journeyId=${encodeURIComponent(initialJourneyId)}`)
      .then((result) => { if (active) { setAnalysis(result); setSubmission(result.submission ?? null); } })
      .catch(() => { if (active) setError("Could not restore this claim review. Please try again."); });
    return () => { active = false; };
  }, [initialJourneyId]);

  async function connect() {
    setError("");
    setBusy("connect");
    try {
      const { url } = await requestJson<{ url: string }>("/api/provider/connect", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }),
      });
      setProviderLoginUrl(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open provider login.");
    } finally {
      setBusy(null);
    }
  }

  async function selectPolicy(policyId: string) {
    setError("");
    setBusy("policy");
    try {
      const data = await requestJson<Session>("/api/provider/select", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ policyId }),
      });
      setSession(data);
      setChangingProvider(false);
      onAssessment?.("");
      setAnalysis(null);
      setSubmission(null);
      setApproved(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not select this policy.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setError("");
    setBusy("disconnect");
    try {
      const data = await requestJson<Session>("/api/provider/disconnect", { method: "POST" });
      setSession(data);
      setAnalysis(null);
      onAssessment?.("");
      setSubmission(null);
      setApproved(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not disconnect this account.");
    } finally {
      setBusy(null);
    }
  }

  async function analyze() {
    if (!bill) return;
    setError("");
    setBusy("analyze");
    const form = new FormData();
    form.set("bill", bill);
    if (discharge) form.set("discharge", discharge);
    if (receipt) form.set("receipt", receipt);
    if (paymentSignal) form.set("paymentOrderId", paymentSignal.orderId);
    try {
      const result = await requestJson<Analysis>("/api/claim/analyze", { method: "POST", body: form });
      setAnalysis(result);
      onAssessment?.(result.journeyId);
      setSubmission(null);
      setApproved(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read the bill.");
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (!analysis || !approved) return;
    setError("");
    setBusy("submit");
    try {
      const result = await requestJson<{ claimId: string; status: string }>("/api/claim/submit", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ journeyId: analysis.journeyId, approved: true }),
      });
      setSubmission(result);
      refreshSession().catch(() => {});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The mock insurer did not accept the claim.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={embedded ? "w-full text-ink" : "min-h-dvh bg-[#f7f5eb] px-4 pb-16 text-ink sm:px-6"}>
      {!embedded && <header className="mx-auto flex max-w-5xl items-center justify-between border-b border-line py-5">
        <Link href="/" className="flex items-center gap-2"><Mark size={34} /><Wordmark className="text-2xl" /></Link>
        <span className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-bold text-ink-2">SIMULATION</span>
      </header>}

      {providerLoginUrl && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setProviderLoginUrl(""); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="provider-login-title" className="flex h-[min(760px,94dvh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
            <div><h2 id="provider-login-title" className="font-bold">Sign in to {names[provider]}</h2><p className="text-xs text-ink-3">Fynish simulation · prefilled account only</p></div>
            <button type="button" aria-label="Close sign-in" onClick={() => setProviderLoginUrl("")} className="grid size-9 place-items-center rounded-full text-xl text-ink-2 hover:bg-cream">×</button>
          </div>
          <iframe ref={loginFrame} title={`${names[provider]} sign-in simulation`} src={providerLoginUrl} className="min-h-0 w-full flex-1 border-0 bg-white" />
        </section>
      </div>}

      <div className={embedded ? "w-full" : "mx-auto max-w-5xl pt-10 sm:pt-14"}>
        {!embedded && <>
        <p className="text-xs font-extrabold uppercase tracking-widest text-blue">Your claim, step by step</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-[-.05em] sm:text-5xl">Start with your cover. Then your bill.</h1>
        <p className="mt-4 max-w-2xl leading-7 text-ink-2">Connect your insurer account, choose your policy, and see a claim estimate before filing.</p>
        </>}

        {error && <div role="alert" className="mt-7 rounded-xl border border-red bg-red-tint px-4 py-3 text-sm font-semibold text-red">{error}</div>}

        <div className={embedded ? "grid gap-4" : "mt-8 grid gap-5"}>
          {(!embedded || !session?.connected || changeProviderRequested) && <Step embedded={embedded} number={1} title={changeProviderRequested ? "Change insurance provider" : "Choose your insurer"}>
            {changeProviderRequested && session?.connected && <p className="mb-4 rounded-xl bg-blue-tint px-4 py-3 text-sm leading-6 text-ink-2">You are connected to {names[session.provider ?? provider]}. Choose “Disconnect and choose another” below to switch insurer simulations.</p>}
            <p className="mb-4 text-sm leading-6 text-ink-2">Choose the insurer where you hold a health policy. This Fynish flow uses fictional insurer accounts.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["star", "hdfc-ergo"] as const).map((id) => (
                <label key={id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${provider === id ? "border-blue bg-blue-tint" : "border-line bg-white hover:border-blue"}`}>
                  <input type="radio" name="provider" value={id} checked={provider === id} disabled={session?.connected} onChange={() => setManualProvider(id)} className="accent-blue" />
                  <span className="font-bold">{names[id]}</span><span className="ml-auto text-xs font-semibold text-ink-3">mock portal</span>
                </label>
              ))}
            </div>
            {!session?.connected ? (
              <button type="button" onClick={connect} disabled={busy !== null} className="mt-5 rounded-xl bg-blue px-5 py-3 font-bold text-white disabled:opacity-50">
                {busy === "connect" ? "Opening login…" : `Connect ${names[provider]}`}
              </button>
            ) : <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-green-tint px-4 py-3 text-sm font-semibold text-green">
              <span>Connected to {names[session.provider ?? provider]} as {session.account?.name ?? "account holder"}.</span>
              <button type="button" onClick={disconnect} disabled={busy !== null} className="text-xs font-bold underline underline-offset-2 disabled:opacity-50">{changeProviderRequested ? "Disconnect and choose another" : "Disconnect"}</button>
            </div>}
          </Step>}

          {(!embedded || (session?.connected && (!session.selectedPolicy || changeProviderRequested))) && <Step embedded={embedded} number={2} title="Choose your policy">
            {!session?.connected ? <p className="text-sm text-ink-3">Connect an insurer account to load its policies.</p> : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(session.policies ?? []).map((policy) => (
                    <button key={policy.id} type="button" onClick={() => selectPolicy(policy.id)} disabled={busy !== null || policy.status.toUpperCase() !== "ACTIVE"} className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-50 ${session.selectedPolicyId === policy.id ? "border-blue bg-blue-tint" : "border-line bg-white hover:border-blue"}`}>
                      <span className="block font-bold">{policy.product}</span>
                      <span className="mt-2 block text-xs text-ink-2">{policy.policyNumberMasked} · {policy.status}</span>
                    </button>
                  ))}
                </div>
                {session.selectedPolicy && <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 rounded-xl bg-cream px-4 py-3 text-sm">
                  <span>Policy cover <strong>{rupees(session.selectedPolicy.sumInsuredPaise ?? 0)}</strong></span>
                  <span>Remaining cover <strong>{session.balance ? rupees(session.balance.remainingBalancePaise) : "Loading…"}</strong></span>
                  {session.selectedPolicy.policyStart && <span>Policy start <strong>{session.selectedPolicy.policyStart}</strong></span>}
                  {session.selectedPolicy.coPayPct !== undefined && <span>Co-pay <strong>{session.selectedPolicy.coPayPct}%</strong></span>}
                  {!!session.selectedPolicy.insuredPeople?.length && <span>Covered people <strong>{session.selectedPolicy.insuredPeople.map((person) => person.name).join(", ")}</strong></span>}
                </div>}
              </>
            )}
          </Step>}

          {(!embedded || (session?.selectedPolicy && !changeProviderRequested)) && <Step embedded={embedded} number={3} title="Upload your bill">
            {!session?.selectedPolicy ? <p className="text-sm text-ink-3">Choose a policy first. Then add the hospital bill.</p> : (
              <>
                {paymentSignal && <div className="mb-4 rounded-xl border border-blue/15 bg-blue-tint p-4 text-sm"><strong className="text-blue">Hospital payment found</strong><p className="mt-1 text-ink-2">{paymentSignal.hospitalName} · {rupees(paymentSignal.amountPaise)}{paymentSignal.paidAt ? ` · ${new Date(paymentSignal.paidAt).toLocaleString("en-IN")}` : ""}</p><p className="mt-1 text-xs text-ink-3">Attach the itemised bill so Fynish can check whether the payment matches the claim.</p></div>}
                <p className="mb-4 text-sm leading-6 text-ink-2">Add a clear photo or PDF. Use sample or anonymized documents. A discharge summary helps check dates and diagnosis.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="cursor-pointer rounded-xl border border-dashed border-line bg-white p-4 hover:border-blue">
                    <span className="block text-sm font-bold">Hospital bill *</span><span className="mt-1 block truncate text-xs text-ink-3">{bill?.name ?? "Take a clear photo or choose a PDF"}</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="mt-3 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-tint file:px-3 file:py-2 file:font-bold file:text-blue" onChange={(event) => { setBill(event.target.files?.[0] ?? null); setAnalysis(null); onAssessment?.(""); setSubmission(null); setApproved(false); }} />
                  </label>
                  <label className="cursor-pointer rounded-xl border border-dashed border-line bg-white p-4 hover:border-blue">
                    <span className="block text-sm font-bold">Discharge summary</span><span className="mt-1 block truncate text-xs text-ink-3">{discharge?.name ?? "Optional image or PDF"}</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="mt-3 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-tint file:px-3 file:py-2 file:font-bold file:text-blue" onChange={(event) => { setDischarge(event.target.files?.[0] ?? null); setAnalysis(null); onAssessment?.(""); setSubmission(null); setApproved(false); }} />
                  </label>
                  <label className="cursor-pointer rounded-xl border border-dashed border-line bg-white p-4 hover:border-blue">
                    <span className="block text-sm font-bold">Payment receipt</span><span className="mt-1 block truncate text-xs text-ink-3">{receipt?.name ?? "Optional hospital receipt, image or PDF"}</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="mt-3 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-tint file:px-3 file:py-2 file:font-bold file:text-blue" onChange={(event) => { setReceipt(event.target.files?.[0] ?? null); setAnalysis(null); onAssessment?.(""); setSubmission(null); setApproved(false); }} />
                  </label>
                </div>
                <button type="button" onClick={analyze} disabled={!bill || busy !== null} className="mt-5 rounded-xl bg-blue px-5 py-3 font-bold text-white disabled:opacity-50">
                  {busy === "analyze" ? "Reading documents…" : "Check this claim"}
                </button>
              </>
            )}
          </Step>}

          {analysis && <Step embedded={embedded} number={4} title="Review your claim">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-cream p-4"><span className="text-xs font-semibold text-ink-2">Policy cover</span><strong className="mt-1 block text-xl">{typeof session?.selectedPolicy?.sumInsuredPaise === "number" ? rupees(session.selectedPolicy.sumInsuredPaise) : "—"}</strong></div>
              <div className="rounded-xl bg-green-tint p-4"><span className="text-xs font-semibold text-ink-2">Estimated claim</span><strong className="mt-1 block text-xl text-green">{analysis.amountSummary.estimatedPayablePaise === null ? "Needs review" : rupees(analysis.amountSummary.estimatedPayablePaise)}</strong></div>
              <div className="rounded-xl bg-cream p-4"><span className="text-xs font-semibold text-ink-2">Remaining cover</span><strong className="mt-1 block text-xl">{session?.balance ? rupees(session.balance.remainingBalancePaise) : "Loading…"}</strong></div>
            </div>
            <p className="mt-4 text-sm text-ink-2">{analysis.bill.hospitalName}. The estimate uses the connected policy terms; the insurer decides the final payable amount.</p>
            <VoicePlayback language="en-IN" text={`Policy cover: ${typeof session?.selectedPolicy?.sumInsuredPaise === "number" ? rupees(session.selectedPolicy.sumInsuredPaise) : "not available"}. ${analysis.amountSummary.estimatedPayablePaise === null ? "Estimated claim amount needs review." : `Estimated claim amount: ${rupees(analysis.amountSummary.estimatedPayablePaise)}.`} Remaining cover: ${session?.balance ? rupees(session.balance.remainingBalancePaise) : "not available"}. The insurer decides the final payable amount.`} />
            {analysis.paymentCheck && <p className={`mt-3 rounded-xl p-3 text-sm ${analysis.paymentCheck === "matched" ? "bg-green-tint text-green" : "bg-amber-tint text-amber-ink"}`}>{analysis.paymentCheck === "matched" ? "The checkout payment amount and hospital match the uploaded bill. Please confirm this is the right bill; a match alone does not prove it." : analysis.paymentCheck === "amount_mismatch" ? "The payment amount differs from the uploaded bill. Check both before filing." : "The hospital name differs from the payment record. Check both before filing."}</p>}
            {analysis.amountSummary.estimateUnavailableReason && <p className="mt-3 rounded-xl bg-amber-tint p-3 text-sm text-amber-ink">{analysis.amountSummary.estimateUnavailableReason}</p>}
            <h3 className="mt-7 font-bold">Bill items</h3>
            <div className="mt-3 divide-y divide-line rounded-xl border border-line">
              {analysis.amountSummary.items.map((item, index) => <div key={`${item.label}-${index}`} className="grid gap-1 p-4 sm:grid-cols-[1fr_auto]">
                <div><span className="font-semibold">{item.label}</span><p className="mt-1 text-xs text-ink-2">{item.reason}{item.clauseRef && analysis.citations.some((citation) => citation.clauseRef === item.clauseRef && citation.text && citation.source === "policy_wording") ? ` · Clause ${item.clauseRef}` : ""}</p></div>
                <span className="text-sm font-bold">{rupees(item.amountPaise)} · {item.status === "covered" ? "Potentially covered" : item.status === "excluded" ? "Potential exclusion" : "Needs review"}</span>
              </div>)}
            </div>
            {analysis.readiness.breakdown.filter((rule) => rule.passed === false).length > 0 && <div className="mt-6">
              <h3 className="font-bold">What needs attention</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-ink-2">
                {analysis.readiness.breakdown.filter((rule) => rule.passed === false).map((rule) => <li key={rule.ruleId}>{rule.reason}{rule.whatToDo ? ` ${rule.whatToDo}` : ""}</li>)}
              </ul>
            </div>}
            {analysis.citations.some((citation) => citation.text && citation.source !== "unavailable") && <div className="mt-6"><h3 className="mb-2 font-bold">Policy clauses</h3>{analysis.citations.filter((citation) => citation.text && citation.source !== "unavailable").map((citation, index) => <details key={`${citation.clauseRef}-${index}`} className="mb-2 rounded-xl border border-line bg-white p-3 text-sm"><summary className="cursor-pointer font-bold">{citation.source === "synthetic_demo" ? "Illustrative policy term" : `Clause ${citation.clauseRef}`}{citation.page === null ? "" : ` · page ${citation.page}`}</summary><p className="mt-2 whitespace-pre-wrap leading-6 text-ink-2">{citation.source === "synthetic_demo" ? citation.text?.replace(/^SYNTHETIC (?:DEMO )?TERM:\s*/u, "") : citation.text}</p><p className="mt-2 text-xs text-ink-3">{citation.source === "synthetic_demo" ? "Synthetic wording; not insurer-issued" : "Reference policy wording"}</p></details>)}</div>}
            {analysis.warnings.length > 0 && <ul className="mt-5 list-disc space-y-1 pl-5 text-xs text-amber-ink">{analysis.warnings.map((warning, index) => <li key={index}>{warning === "Some policy clause text is unavailable. Seed the policy wording or review it manually." ? "Some referenced terms could not be checked. Confirm them with your insurer." : warning}</li>)}</ul>}
            {!submission && <div className="mt-7 border-t border-line pt-6">
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} className="mt-1 accent-blue" /><span>I reviewed the details and want to submit this sample claim.</span></label>
              <button type="button" onClick={submit} disabled={!approved || !analysis.readiness.readyToSubmit || busy !== null} className="mt-4 rounded-xl bg-blue px-5 py-3 font-bold text-white disabled:opacity-50">{busy === "submit" ? "Submitting…" : "Submit sample claim"}</button>
              {!analysis.readiness.readyToSubmit && <p className="mt-2 text-xs text-amber-ink">Add or correct the requested documents before filing.</p>}
            </div>}
            {submission && <p role="status" className="mt-6 rounded-xl bg-green-tint p-4 font-bold text-green">Sample claim {submission.claimId} · {submission.status}</p>}
          </Step>}
        </div>
      </div>
    </div>
  );
}
