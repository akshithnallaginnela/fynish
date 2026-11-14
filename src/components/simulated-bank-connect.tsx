"use client";

import { useEffect, useRef, useState } from "react";

export type BankSession = {
  connected: boolean;
  source: "simulation";
  account?: { id: string; bankName: string; accountHolder: string; accountNumberMasked: string; accountType: string };
};
export type BankTransaction = { id: string; merchantName: string; amountPaise: number; paidAt: string; method: "UPI" };

export default function SimulatedBankConnect({ session, onChange }: { session: BankSession | null; onChange: (session: BankSession) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.type !== "fynish-simulated-bank-connected") return;
      fetch("/api/bank/session", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error("Session unavailable");
        return response.json() as Promise<BankSession>;
      }).then((result) => {
        if (!active) return;
        if (!result.connected) throw new Error("Not connected");
        setError("");
        onChange(result);
        window.dispatchEvent(new Event("fynish:bank-connection-changed"));
      }).catch(() => { if (active) setError("Could not confirm the account connection. Please try again."); });
    }
    window.addEventListener("message", onMessage);
    return () => { active = false; window.removeEventListener("message", onMessage); };
  }, [onChange]);

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/bank/disconnect", { method: "POST" });
      const result = await response.json() as BankSession;
      if (!response.ok || result.connected !== false) throw new Error("Disconnect failed");
      onChange(result);
      window.dispatchEvent(new Event("fynish:bank-connection-changed"));
    } catch { setError("Could not disconnect the account. Please try again."); }
    finally { setBusy(false); }
  }

  if (!session) return <p className="p-6 text-sm text-ink-2" role="status">Loading account…</p>;
  return <div className="w-full">
    {session.connected && session.account ? <div className="m-5 rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-ink">Payment account</p><p className="mt-1 text-xs text-ink-2">Test connection</p></div><span className="text-xs font-bold text-green">Connected</span></div>
      <p className="mt-3 text-xs text-ink-3">Simulated account and fictional transactions.</p>
      <button type="button" disabled={busy} onClick={() => void disconnect()} className="mt-4 text-sm font-semibold text-ink-2 underline underline-offset-2 disabled:opacity-50">{busy ? "Disconnecting…" : "Disconnect account"}</button>
    </div> : <iframe ref={frame} src="/bank-connect" title="Payment account connection (test)" className="block w-full border-0 bg-[#eef1f8]" style={{ height: "min(680px, 76dvh)" }} />}
    {error && <p role="alert" className="px-5 pb-4 text-sm text-red-700">{error}</p>}
  </div>;
}
