"use client";

import { useEffect, useRef, useState } from "react";
import Mark from "@/components/mark";
import Wordmark from "@/components/wordmark";
import SimulatedBankConnect, { type BankSession } from "@/components/simulated-bank-connect";
import "./onboarding-steps.css";

type Provider = "star" | "hdfc-ergo";
type ProviderSession = { connected: boolean; provider?: Provider; account?: { name?: string }; selectedPolicyId?: string; policies?: Array<{ id: string }> };
const providers: Array<{ id: Provider; name: string; detail: string }> = [
  { id: "star", name: "Star Health", detail: "Connect your Star Health policy" },
  { id: "hdfc-ergo", name: "HDFC ERGO", detail: "Connect your HDFC ERGO policy" },
];
function providerFromText(value: string): Provider | "" {
  const text = value.toLowerCase().replace(/[^a-z]/g, "");
  if (text === "star" || text === "starhealth" || text === "starhealthinsurance") return "star";
  if (text === "hdfc" || text === "hdfcergo" || text === "hdfcergoinsurance") return "hdfc-ergo";
  return "";
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || "Something went wrong. Please try again.");
  return body as T;
}

export default function OnboardingSteps({ onComplete, onBack }: {
  onComplete: (answers: Record<string, string>) => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<Provider | "">("");
  const [providerInput, setProviderInput] = useState("");
  const [providerSession, setProviderSession] = useState<ProviderSession | null>(null);
  const [providerLoginUrl, setProviderLoginUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bankSession, setBankSession] = useState<BankSession | null>(null);
  const [bankPopupOpen, setBankPopupOpen] = useState(false);
  const loginFrame = useRef<HTMLIFrameElement>(null);
  const selectedProvider = providers.find((item) => item.id === provider);

  useEffect(() => {
    let active = true;
    fetch("/api/bank/session", { cache: "no-store" }).then((response) => response.ok ? response.json() : null)
      .then((session) => { if (active) setBankSession(session ?? { connected: false, source: "simulation" }); })
      .catch(() => { if (active) setBankSession({ connected: false, source: "simulation" }); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== loginFrame.current?.contentWindow) return;
      if (event.data?.type === "fynish-provider-error") {
        setProviderLoginUrl("");
        setError("Provider sign-in did not finish. Please try again.");
        return;
      }
      if (event.data?.type !== "fynish-provider-connected") return;
      setProviderLoginUrl("");
      setBusy(true);
      void (async () => {
        try {
          let session = await requestJson<ProviderSession>("/api/provider/session", { cache: "no-store" });
          if (!session.connected || session.provider !== provider) throw new Error("Could not confirm the insurer connection. Please try again.");
          if (!session.selectedPolicyId && session.policies?.length === 1) {
            try {
              session = await requestJson<ProviderSession>("/api/provider/select", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ policyId: session.policies[0].id }),
              });
            } catch {
              // The claim screen still allows the customer to choose their policy.
            }
          }
          if (active) { setProviderSession(session); setError(""); }
        } catch (cause) {
          if (active) setError(cause instanceof Error ? cause.message : "Could not load the insurer connection.");
        } finally {
          if (active) setBusy(false);
        }
      })();
    };
    window.addEventListener("message", onMessage);
    return () => { active = false; window.removeEventListener("message", onMessage); };
  }, [provider]);

  const finish = (connected: boolean) => onComplete({
    name: name.trim(),
    provider,
    bankConnected: connected ? "true" : "false",
    ...(connected ? { bankConnectionMode: "razorpay-test" } : {}),
  });

  const connectProvider = async () => {
    if (!provider || busy) return;
    setError("");
    setBusy(true);
    try {
      const { url } = await requestJson<{ url: string }>("/api/provider/connect", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }),
      });
      setProviderLoginUrl(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open the insurer sign-in.");
    } finally {
      setBusy(false);
    }
  };

  const closeBankPopup = () => {
    setBankPopupOpen(false);
  };
  const goForward = () => {
    if (step === 0 && name.trim()) setStep(1);
    else if (step === 1 && providerSession?.connected) setStep(2);
    else if (step === 1) void connectProvider();
    else if (bankSession?.connected) finish(false);
    else setBankPopupOpen(true);
  };
  const goBack = () => {
    setError("");
    if (step === 0) onBack();
    else setStep(step === 2 ? 1 : 0);
  };
  const continueLabel = step === 0 ? "Continue" : step === 1
    ? providerSession?.connected ? "Continue" : "Connect insurer"
    : bankSession?.connected ? "Finish setup" : "Connect bank";

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <div className="onboarding-brand"><Mark size={34} /><Wordmark className="text-3xl" /></div>
        <span className="onboarding-preview">Step {step + 1} of 3</span>
      </header>
      <div className="onboarding-content">
        <div className="onboarding-progressRow">
          <button type="button" className="onboarding-back" onClick={goBack} aria-label={step === 0 ? "Back to welcome" : "Previous step"}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7" /></svg>
          </button>
          <div className="onboarding-progressGroup">
            <div className="onboarding-progressLabels"><span>Let’s get started</span><span>{step + 1} / 3</span></div>
            <div className="onboarding-progressTrack" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1}>
              <div className="onboarding-progressFill" style={{ width: ((step + 1) / 3) * 100 + "%" }} />
            </div>
          </div>
        </div>

        {step === 0 ? (
          <section key="name" className="onboarding-question">
            <div className="onboarding-assistant"><span className="onboarding-mark"><Mark size={38} /></span><span>Welcome to Fynish</span></div>
            <p className="onboarding-eyebrow">First, your name</p>
            <h1>What should we call you?</h1>
            <p className="onboarding-description">We’ll use your first name to make this feel more personal.</p>
            <label className="mt-7 block text-sm font-bold" htmlFor="customer-name">Your name</label>
            <input id="customer-name" autoComplete="given-name" autoFocus maxLength={60} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) goForward(); }} className="mt-2 min-h-14 w-full rounded-xl border-2 border-line bg-white px-4 text-lg outline-none transition focus:border-blue" placeholder="e.g. Ravi" />
          </section>
        ) : step === 1 ? (
          <section key="insurer" className="onboarding-question">
            <div className="onboarding-assistant"><span className="onboarding-mark"><Mark size={38} /></span><span>Welcome, {name.trim()}</span></div>
            <p className="onboarding-eyebrow">Your health cover</p>
            <h1>Who is your insurer?</h1>
            <p className="onboarding-description">Type your insurer’s name to continue to its account simulation.</p>
            <label className="mt-7 block text-sm font-bold" htmlFor="insurance-provider">Insurance provider</label>
            <input id="insurance-provider" autoComplete="off" maxLength={80} value={providerInput} disabled={!!providerSession?.connected} onChange={(event) => { const value = event.target.value; setProviderInput(value); setProvider(providerFromText(value)); setError(""); }} className="mt-2 min-h-14 w-full rounded-xl border-2 border-line bg-white px-4 text-lg outline-none transition focus:border-blue disabled:opacity-60" placeholder="e.g. Star Health or HDFC ERGO" aria-describedby="insurance-provider-help" />
            <p id="insurance-provider-help" className="mt-2 text-xs leading-5 text-ink-3">{provider ? `Ready to connect ${selectedProvider?.name}.` : "Type Star Health or HDFC ERGO to connect."}</p>
            {providerSession?.connected && <p className="onboarding-connected-note" role="status">Connected to {selectedProvider?.name}{providerSession.account?.name ? " as " + providerSession.account.name : ""}.</p>}
            {error && <p className="onboarding-error" role="alert">{error}</p>}
          </section>
        ) : (
          <section key="payments" className="onboarding-question">
            <div className="onboarding-assistant"><span className="onboarding-mark"><Mark size={38} /></span><span>One more choice</span></div>
            <p className="onboarding-eyebrow">Bank account · optional</p>
            <h1>Connect your bank?</h1>
            <p className="onboarding-description">Connect your account to see transactions that may be related to a claim.</p>
            <div className={"onboarding-bank-card " + (bankSession?.connected ? "is-connected" : "")}>
              <span className="onboarding-bank-icon" aria-hidden="true">₹</span>
              <span><strong>{bankSession?.connected ? "Account connected" : "Connect your bank"}</strong><small>Simulated connection</small></span>
              <span className="onboarding-bank-status" aria-hidden="true">{bankSession?.connected ? "✓" : "○"}</span>
            </div>
            {bankSession?.connected && <p className="onboarding-connected-note" role="status">Your simulated account is connected.</p>}
            <p className="onboarding-description">No real bank or UPI account is accessed.</p>
          </section>
        )}
      </div>
      <footer className="onboarding-footer">
        <div className="onboarding-footerInner">
          <p>{step === 2 ? "You can skip this and connect later from transaction history." : "Fynish simulation · use the prefilled account only."}</p>
          <div className="onboarding-footerActions">
            {step === 2 && !bankSession?.connected && <button type="button" className="onboarding-skip" onClick={() => finish(false)}>Do this later</button>}
            <button type="button" className="onboarding-continue" disabled={busy || (step === 0 ? !name.trim() : step === 1 ? !provider : false)} onClick={goForward}>{busy ? "Connecting…" : continueLabel}<span aria-hidden="true">→</span></button>
          </div>
        </div>
      </footer>

      {providerLoginUrl && <div className="onboarding-modalBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setProviderLoginUrl(""); }} onKeyDown={(event) => { if (event.key === "Escape") setProviderLoginUrl(""); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="onboarding-provider-title" className="onboarding-providerModal">
          <header><div><h2 id="onboarding-provider-title">Sign in to {selectedProvider?.name}</h2><p>Fynish simulation · prefilled account only</p></div><button type="button" onClick={() => setProviderLoginUrl("")} aria-label="Close insurer sign-in">×</button></header>
          <iframe ref={loginFrame} title={(selectedProvider?.name ?? "Insurer") + " sign-in simulation"} src={providerLoginUrl} />
        </section>
      </div>}

      {bankPopupOpen && <div className="onboarding-modalBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeBankPopup(); }} onKeyDown={(event) => { if (event.key === "Escape") closeBankPopup(); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="onboarding-bank-title" className="onboarding-bankModal">
          <header><div><p>SIMULATED CONNECTION</p><h2 id="onboarding-bank-title">Connect your account</h2></div><button type="button" onClick={closeBankPopup} aria-label="Close account connection">×</button></header>
          <SimulatedBankConnect session={bankSession} onChange={(session) => { setBankSession(session); if (session.connected) closeBankPopup(); }} />
        </section>
      </div>}
    </main>
  );
}
