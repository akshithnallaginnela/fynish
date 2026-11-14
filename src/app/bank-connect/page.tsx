"use client";

import { useId, useState, type FormEvent } from "react";
import { sampleBankLogin } from "@/lib/bank/sample-login";

const methods = [
  { name: "Credit/Debit Card", detail: "Card details", icon: "▤", available: true },
  { name: "Netbanking", detail: "Not available", icon: "▥", available: false },
  { name: "Wallet", detail: "Not available", icon: "▣", available: false },
  { name: "UPI", detail: "Not available", icon: "↗", available: false },
];

export default function BankConnectPortal() {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const isExample = String(fields.get("example-card") ?? "").replace(/\s/g, "") === "123456789101"
      && String(fields.get("example-expiry") ?? "").trim() === "07/32"
      && String(fields.get("example-code") ?? "").trim() === "363"
      && String(fields.get("example-name") ?? "").trim().toLowerCase() === "ravi kumar";
    for (const key of ["example-card", "example-expiry", "example-code", "example-name"]) fields.delete(key);
    if (!isExample) {
      form.reset();
      setError("Use the fictional details shown in the fields to continue.");
      return;
    }
    form.reset();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/bank/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId: "fynish-sample-1", consent: true, identifier: sampleBankLogin.identifier, accessCode: sampleBankLogin.accessCode }),
      });
      const result = await response.json();
      if (!response.ok || result?.connected !== true) throw new Error("Connection failed");
      setConnected(true);
      if (window.parent !== window) window.parent.postMessage({ type: "fynish-simulated-bank-connected" }, window.location.origin);
    } catch {
      setError("Could not connect this account. Please try again.");
    } finally { setBusy(false); }
  }

  const input = "mt-2 block h-11 w-full rounded border border-[#d8dee8] bg-white px-3 text-sm text-[#26354c] outline-none placeholder:text-[#9aa5b5] focus:border-[#4398f6] focus:ring-2 focus:ring-[#4398f6]/20";
  return <main className="flex min-h-screen items-center justify-center bg-[#eff2f8] p-3 text-[#26354c] sm:p-6">
    <section className="w-full max-w-[730px] overflow-hidden rounded-xl border border-[#dfe5ef] bg-white shadow-[0_8px_30px_#17264a16]">
      <div className="h-1.5 bg-[#4899f5]" />
      {connected ? <div className="px-6 py-16 text-center" role="status"><span aria-hidden="true" className="mx-auto grid size-11 place-items-center rounded-full bg-green-tint text-xl font-bold text-green">✓</span><h1 className="mt-4 text-lg font-bold">Account connected</h1><p className="mt-2 text-sm text-ink-2">Return to Fynish to view your transactions.</p>{typeof window !== "undefined" && window.parent === window && <a href="/transactions" className="mt-5 inline-block rounded-lg bg-[#4899f5] px-5 py-3 text-sm font-bold text-white">View transactions</a>}</div> : <div className="grid sm:grid-cols-[230px_minmax(0,1fr)]">
        <div className="border-b border-[#e9edf3] py-5 sm:border-b-0 sm:border-r">
          <h1 className="px-5 text-sm font-bold">Select a payment method</h1>
          <div className="mt-3 grid grid-cols-2 sm:block">
            {methods.map((method) => <button key={method.name} type="button" disabled={!method.available} aria-pressed={method.available} className={`flex w-full items-center gap-3 border-t border-[#eef0f4] px-5 py-3 text-left ${method.available ? "bg-[#eef5ff]" : "text-[#9aa5b5]"}`}>
              <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded bg-[#e9f3ff] text-base font-bold text-[#4899f5]">{method.icon}</span>
              <span className="min-w-0"><strong className="block text-xs">{method.name}</strong><small className="mt-0.5 block text-[10px]">{method.detail}</small></span>
            </button>)}
          </div>
        </div>
        <form autoComplete="off" onSubmit={(event) => void connect(event)} className="p-5 sm:p-7">
          <p className="text-xs font-semibold text-[#79869a]">Payment account</p>
          <h2 className="mt-2 text-lg font-bold tracking-tight">Connect your account</h2>
          <div className="mt-2 h-1 w-8 rounded bg-[#4899f5]" />
          <p className="mt-4 text-xs leading-5 text-[#66758a]">Simulation only. Use fictional details; no bank or UPI account is linked.</p>
          <h3 className="mt-5 text-sm font-bold">Connect with Credit/Debit Card</h3>
          <label htmlFor={`${id}-card`} className="mt-4 block text-xs font-semibold">Card Number</label>
          <input id={`${id}-card`} name="example-card" type="text" inputMode="numeric" autoComplete="off" required maxLength={14} defaultValue="1234 5678 9101" placeholder="1234 5678 9101" className={input} />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <label htmlFor={`${id}-expiry`} className="block text-xs font-semibold">Expiry Date<input id={`${id}-expiry`} name="example-expiry" type="text" inputMode="numeric" autoComplete="off" required maxLength={5} defaultValue="07/32" placeholder="MM / YY" className={input} /></label>
            <label htmlFor={`${id}-code`} className="block text-xs font-semibold">CVV<input id={`${id}-code`} name="example-code" type="password" inputMode="numeric" autoComplete="off" required maxLength={3} defaultValue="363" placeholder="•••" className={input} /></label>
          </div>
          <label htmlFor={`${id}-name`} className="mt-4 block text-xs font-semibold">Cardholder&apos;s Name</label>
          <input id={`${id}-name`} name="example-name" type="text" autoComplete="off" required maxLength={30} defaultValue="Ravi Kumar" placeholder="Ravi Kumar" className={input} />
          <label className="mt-5 flex cursor-pointer items-start gap-2 text-xs leading-5 text-[#66758a]"><input name="consent" type="checkbox" required className="mt-0.5 size-4 shrink-0 accent-[#4899f5]" /><span>I agree to view this simulated account’s transactions.</span></label>
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className="mt-5 min-h-12 w-full rounded bg-[#4899f5] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#2f80df] disabled:opacity-45">{busy ? "Connecting…" : "Connect account"}</button>
        </form>
      </div>}
    </section>
  </main>;
}
