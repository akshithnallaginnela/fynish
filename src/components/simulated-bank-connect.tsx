"use client";

import { useState } from "react";

export type BankSession = {
  connected: boolean;
  source: "simulation";
  account?: { id: string; bankName: string; accountHolder: string; accountNumberMasked: string; accountType: string };
};
export type BankTransaction = { id: string; merchantName: string; amountPaise: number; paidAt: string; category: "hospital" | "other"; method: "UPI" };

/** The sample bank is deliberately separate from the checkout alert setting. */
export default function SimulatedBankConnect({ session, onChange }: { session: BankSession | null; onChange: (session: BankSession) => void }) {
  const [step, setStep] = useState<"account" | "consent">("account");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function update(connected: boolean) {
    if (busy || (connected && !consent)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/bank/${connected ? "connect" : "disconnect"}`, {
        method: "POST",
        ...(connected ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId: "fynish-sample-1", consent: true }) } : {}),
      });
      const result = await response.json();
      if (!response.ok || typeof result?.connected !== "boolean") throw new Error("Could not update connection");
      onChange(result as BankSession);
      window.dispatchEvent(new Event("fynish:bank-connection-changed"));
      if (!connected) { setStep("account"); setConsent(false); }
    } catch { setError("Could not update the sample bank connection. Please try again."); }
    finally { setBusy(false); }
  }

  if (!session) return <p className="mt-4 text-sm text-ink-2" role="status">Loading account…</p>;
  return <div className="mt-4">
    <div className="rounded-xl bg-cream p-4 text-sm leading-6 text-ink-2">Fynish Sample Bank is a simulated account. Its transactions are fictional and no real bank or UPI account is accessed.</div>
    {session.connected && session.account ? <div className="mt-4 rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-ink">{session.account.bankName}</p><p className="mt-1 text-xs text-ink-2">{session.account.accountHolder} · {session.account.accountType} · {session.account.accountNumberMasked}</p></div><span className="text-xs font-bold text-green">Connected</span></div>
      <button type="button" disabled={busy} onClick={() => void update(false)} className="mt-4 text-sm font-semibold text-ink-2 underline underline-offset-2 disabled:opacity-50">{busy ? "Disconnecting…" : "Disconnect account"}</button>
    </div> : step === "account" ? <div className="mt-5">
      <p className="text-xs font-bold uppercase tracking-wide text-blue">Step 1 of 2 · Account</p>
      <p className="mt-2 text-sm leading-6 text-ink-2">Review the prefilled sample account to continue.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-ink-2">Bank<input readOnly value="Fynish Sample Bank" className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-medium text-ink" /></label>
        <label className="text-xs font-bold text-ink-2">Account holder<input readOnly value="Ravi Kumar" className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-medium text-ink" /></label>
        <label className="text-xs font-bold text-ink-2">Account number<input readOnly value="•••• 4721" className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-medium text-ink" /></label>
        <label className="text-xs font-bold text-ink-2">Account type<input readOnly value="Savings" className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-medium text-ink" /></label>
      </div>
      <button type="button" onClick={() => setStep("consent")} className="mt-4 rounded-xl bg-blue px-4 py-3 text-sm font-bold text-white">Continue with this account</button>
    </div> : <div className="mt-5">
      <p className="text-xs font-bold uppercase tracking-wide text-blue">Step 2 of 2 · Permission</p>
      <p className="mt-2 text-sm leading-6 text-ink-2">Allow Fynish to show the sample account’s fictional transactions.</p>
      <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm leading-6 text-ink-2"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 size-4 accent-blue" /><span>I agree to connect this simulated account.</span></label>
      <button type="button" disabled={!consent || busy} onClick={() => void update(true)} className="mt-4 rounded-xl bg-blue px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Connecting…" : "Connect account"}</button>
      <button type="button" disabled={busy} onClick={() => { setStep("account"); setConsent(false); }} className="ml-4 mt-4 text-sm font-semibold text-ink-2 underline underline-offset-2">Back</button>
    </div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </div>;
}
