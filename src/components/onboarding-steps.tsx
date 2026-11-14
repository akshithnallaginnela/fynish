"use client";

import { useEffect, useRef, useState } from "react";
import Mark from "@/components/mark";
import Wordmark from "@/components/wordmark";
import "./onboarding-steps.css";

type Provider = "star" | "hdfc-ergo";
type ProviderSession = { connected: boolean; provider?: Provider; account?: { name?: string }; selectedPolicyId?: string; policies?: Array<{ id: string }> };
const providers: Array<{ id: Provider; name: string; detail: string }> = [
  { id: "star", name: "Star Health", detail: "Connect your Star Health policy" },
  { id: "hdfc-ergo", name: "HDFC ERGO", detail: "Connect your HDFC ERGO policy" },
];

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
  const [providerSession, setProviderSession] = useState<ProviderSession | null>(null);
  const [providerLoginUrl, setProviderLoginUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bankConnected, setBankConnected] = useState(false);
  const [bankPopupOpen, setBankPopupOpen] = useState(false);
  const [consented, setConsented] = useState(false);
  const loginFrame = useRef<HTMLIFrameElement>(null);
  const selectedProvider = providers.find((item) => item.id === provider);

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
    setConsented(false);
  };
  const authorizeBank = () => {
    if (!consented) return;
    setBankConnected(true);
    closeBankPopup();
  };
  const goForward = () => {
    if (step === 0 && name.trim()) setStep(1);
    else if (step === 1 && providerSession?.connected) setStep(2);
    else if (step === 1) void connectProvider();
    else if (bankConnected) finish(true);
    else setBankPopupOpen(true);
  };
  const goBack = () => {
    setError("");
    if (step === 0) onBack();
    else setStep(step === 2 ? 1 : 0);
  };
  const continueLabel = step === 0 ? "Continue" : step === 1
    ? providerSession?.connected ? "Continue" : "Connect insurer"
    : bankConnected ? "Finish setup" : "Enable payment alerts";

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
            <p className="onboarding-description">Choose your insurer and continue to its account simulation.</p>
            <fieldset className="onboarding-options">
              <legend className="onboarding-srOnly">Select an insurance provider</legend>
              {providers.map((item) => <label key={item.id} className={"onboarding-option " + (provider === item.id ? "onboarding-selected" : "")}>
                <input type="radio" name="provider" value={item.id} checked={provider === item.id} disabled={!!providerSession?.connected} onChange={() => { setProvider(item.id); setError(""); }} />
                <span className="onboarding-optionIcon" aria-hidden="true">▤</span>
                <span className="onboarding-optionText"><strong>{item.name}</strong><span>{item.detail}</span></span>
                <span className="onboarding-check" aria-hidden="true">{provider === item.id ? "✓" : ""}</span>
              </label>)}
            </fieldset>
            {providerSession?.connected && <p className="onboarding-connected-note" role="status">Connected to {selectedProvider?.name}{providerSession.account?.name ? " as " + providerSession.account.name : ""}.</p>}
            {error && <p className="onboarding-error" role="alert">{error}</p>}
          </section>
        ) : (
          <section key="payments" className="onboarding-question">
            <div className="onboarding-assistant"><span className="onboarding-mark"><Mark size={38} /></span><span>One more choice</span></div>
            <p className="onboarding-eyebrow">Payment alerts · optional</p>
            <h1>Connect payment alerts?</h1>
            <p className="onboarding-description">A hospital payment can start a claim check. You will still need to upload the bill.</p>
            <div className={"onboarding-bank-card " + (bankConnected ? "is-connected" : "")}>
              <span className="onboarding-bank-icon" aria-hidden="true">₹</span>
              <span><strong>{bankConnected ? "Payment alerts enabled" : "Enable payment alerts"}</strong><small>{bankConnected ? "Fynish checkout payments only" : "No bank or UPI account linked"}</small></span>
              <span className="onboarding-bank-status" aria-hidden="true">{bankConnected ? "✓" : "○"}</span>
            </div>
            {bankConnected && <p className="onboarding-connected-note" role="status">Alerts are enabled for payments made through Fynish checkout.</p>}
            <p className="onboarding-description">Fynish does not access bank transactions or UPI history.</p>
          </section>
        )}
      </div>
      <footer className="onboarding-footer">
        <div className="onboarding-footerInner">
          <p>{step === 2 ? "You can skip this and enable alerts later." : "Fynish simulation · use the prefilled account only."}</p>
          <div className="onboarding-footerActions">
            {step === 2 && !bankConnected && <button type="button" className="onboarding-skip" onClick={() => finish(false)}>Do this later</button>}
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
          <header><div><p>FYNISH SIMULATION</p><h2 id="onboarding-bank-title">Enable payment alerts</h2></div><button type="button" onClick={closeBankPopup} aria-label="Close payment alerts">×</button></header>
          <p>This only enables alerts for payments made through Fynish checkout. It does not connect a bank account or read UPI history.</p>
          <label className="onboarding-consent"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} /><span>I understand and agree to use simulated checkout payment alerts.</span></label>
          <button type="button" className="onboarding-continue onboarding-modalButton" disabled={!consented} onClick={authorizeBank}>Enable payment alerts <span aria-hidden="true">→</span></button>
        </section>
      </div>}
    </main>
  );
}
