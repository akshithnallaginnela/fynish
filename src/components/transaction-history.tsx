"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Wordmark from "@/components/wordmark";
import { ONBOARDING_KEY } from "@/lib/onboarding";
import "./payment-portal.css";

export type TransactionSignal = { orderId: string; hospitalName: string; amountPaise: number; paymentId: string | null; paidAt: string | null; category: "hospital" | "other" | "unknown" };
const subscribe = (callback: () => void) => { window.addEventListener("storage", callback); return () => window.removeEventListener("storage", callback); };
const snapshot = () => { try { return localStorage.getItem(ONBOARDING_KEY); } catch { return null; } };

export default function TransactionHistory({ embedded = false, onCheckPayment }: { embedded?: boolean; onCheckPayment?: (signal: TransactionSignal) => void } = {}) {
  const rawProfile = useSyncExternalStore(subscribe, snapshot, () => null);
  const [profileOverride, setProfileOverride] = useState<Record<string, string> | null>(null);
  const [consent, setConsent] = useState(false);
  const [signals, setSignals] = useState<TransactionSignal[]>([]);
  const [error, setError] = useState("");
  let parsed: Record<string, string> | null = null;
  try { parsed = rawProfile ? JSON.parse(rawProfile) as Record<string, string> : null; } catch { parsed = null; }
  const profile = profileOverride ?? parsed;
  const connected = profile?.bankConnected === "true";

  useEffect(() => {
    if (!connected) return;
    let active = true;
    const refresh = () => {
      fetch("/api/payment-feed", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error("Could not load transaction history.");
        return response.json();
      }).then((body) => { if (active) { setSignals(Array.isArray(body.signals) ? body.signals : []); setError(""); } })
        .catch(() => { if (active) setError("Could not load transaction history. Try again shortly."); });
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [connected]);

  function enable() {
    if (!profile || !consent) return;
    const next = { ...profile, bankConnected: "true", bankConnectionMode: "razorpay-test" };
    try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify(next)); setProfileOverride(next); window.dispatchEvent(new Event("storage")); }
    catch { setError("Could not save the payment alert setting."); }
  }

  function disconnect() {
    if (!profile) return;
    const next = { ...profile, bankConnected: "false" };
    try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify(next)); setProfileOverride(next); setSignals([]); setConsent(false); window.dispatchEvent(new Event("storage")); }
    catch { setError("Could not update the payment alert setting."); }
  }

  if (embedded) return <section aria-label="Transaction history" className="w-full max-w-2xl rounded-2xl border border-line bg-card p-5 sm:p-6">
    <h3 className="text-lg font-bold text-ink">Your transactions</h3>
    <p className="mt-2 text-sm leading-6 text-ink-2">Fynish checkout payments appear here. A hospital payment can start a claim check after you upload the bill.</p>
    {!profile ? <p className="mt-4 text-sm text-ink-2">Finish setup to see your transactions.</p> : !connected ? <div className="mt-4">
      <p className="text-sm leading-6 text-ink-2">This simulation records only payments made through Fynish checkout. It does not connect a bank account or read UPI history.</p>
      <label className="mt-4 flex items-start gap-2 text-sm text-ink-2"><input type="checkbox" className="mt-1" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I agree to enable alerts for checkout payments.</label>
      <button className="mt-4 rounded-xl bg-blue px-4 py-3 text-sm font-bold text-white disabled:opacity-50" type="button" disabled={!consent} onClick={enable}>Enable payment alerts</button>
    </div> : <>
      {signals.length === 0 ? <p className="mt-4 text-sm text-ink-2">No payments yet.</p> : <ul className="mt-4 divide-y divide-line">{signals.map((signal) => <li key={signal.orderId} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="min-w-0"><strong className="block text-sm text-ink">{signal.hospitalName}</strong><span className="mt-1 block break-all text-xs leading-5 text-ink-3">{signal.category === "hospital" ? "Hospital merchant" : signal.category === "other" ? "Other merchant" : "Merchant"} · {signal.paidAt ? new Date(signal.paidAt).toLocaleString("en-IN") : "Checkout payment"}<br />Transaction: {signal.paymentId ?? signal.orderId}</span></div>
        <div className="flex items-center gap-3"><strong className="whitespace-nowrap text-sm text-ink">₹{(signal.amountPaise / 100).toLocaleString("en-IN")}</strong>{signal.category === "hospital" && onCheckPayment && <button type="button" className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-blue" onClick={() => onCheckPayment(signal)}>Check claim</button>}</div>
      </li>)}</ul>}
      <div className="mt-4 flex flex-wrap items-center gap-4"><a href="/demo-payment" target="_blank" rel="noopener noreferrer" className="rounded-xl bg-blue px-4 py-3 text-sm font-bold text-white">Open checkout ↗</a><button type="button" onClick={disconnect} className="text-sm text-ink-2 underline underline-offset-2">Turn off payment alerts</button></div>
      <p className="mt-3 text-xs leading-5 text-ink-3">Checkout opens in a separate tab. Only hospital payments trigger an alert; a bill is still needed.</p>
    </>}
    {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
  </section>;

  return <main className="payment-portal">
    <header className="payment-header"><Link href="/"><Wordmark className="text-3xl" /></Link><Link href="/">Back to chat ↗</Link></header>
    <section className="payment-content">
      <p className="payment-eyebrow">YOUR ACTIVITY</p>
      <h1>Transaction history.</h1>
      <p className="payment-lead">Review checkout payments and check hospital charges against your policy.</p>
      {!profile ? <div className="payment-card"><h2>Finish setup first</h2><Link className="payment-button" href="/welcome">Go to setup <span>→</span></Link></div> :
       !connected ? <div className="payment-card"><h2>Enable payment alerts</h2><p>Fynish only records payments made through its hosted checkout. It does not connect a bank account or read UPI history.</p><label className="payment-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I agree to enable alerts for checkout payments.</label><button className="payment-button" type="button" disabled={!consent} onClick={enable}>Enable payment alerts <span>→</span></button></div> :
       <div className="payment-card">
         <div className="payment-history-top"><h2>Recent transactions</h2><span>Checkout only</span></div>
         {signals.length === 0 ? <p>No payments yet. Open checkout to make one.</p> : <ul className="payment-history-list">{signals.map((signal) => <li key={signal.orderId}><div><strong>{signal.hospitalName}</strong><small>{signal.category === "hospital" ? "Hospital merchant" : signal.category === "other" ? "Other merchant" : "Merchant"} · {signal.paidAt ? new Date(signal.paidAt).toLocaleString("en-IN") : "Checkout payment"}<br />Transaction: {signal.paymentId ?? signal.orderId}</small></div><b>₹{(signal.amountPaise / 100).toLocaleString("en-IN")}</b></li>)}</ul>}
         <a href="/demo-payment" target="_blank" rel="noopener noreferrer" className="payment-button">Open checkout <span>↗</span></a>
         <p className="payment-note">Card details go directly to the payment provider’s hosted checkout; Fynish does not receive card numbers. Only hospital payments trigger a claim-check alert.</p>
       </div>}
      {error && <p className="payment-error" role="alert">{error}</p>}
    </section>
  </main>;
}
