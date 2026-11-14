"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Wordmark from "@/components/wordmark";
import { DEMO_MERCHANTS, type DemoMerchantId } from "@/lib/payment-merchants";
import { ONBOARDING_KEY } from "@/lib/onboarding";
import "./payment-portal.css";

type CheckoutReply = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type CheckoutOptions = { key: string; amount: number; currency: string; name: string; description: string; order_id: string; handler: (reply: CheckoutReply) => void; modal: { ondismiss: () => void } };
type CheckoutWindow = Window & { Razorpay?: new (options: CheckoutOptions) => { open(): void } };
const subscribe = (callback: () => void) => { window.addEventListener("storage", callback); return () => window.removeEventListener("storage", callback); };
const profileSnapshot = () => { try { return localStorage.getItem(ONBOARDING_KEY); } catch { return null; } };

function loadCheckout() {
  return new Promise<void>((resolve, reject) => {
    const browser = window as CheckoutWindow;
    if (browser.Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => browser.Razorpay ? resolve() : reject(new Error("Checkout is unavailable."));
    script.onerror = () => { script.remove(); reject(new Error("Could not load Razorpay checkout.")); };
    document.body.appendChild(script);
  });
}

export default function DemoPaymentCenter() {
  const savedProfile = useSyncExternalStore(subscribe, profileSnapshot, () => null);
  const [merchantId, setMerchantId] = useState<DemoMerchantId>("hospital");
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState("");
  const [paid, setPaid] = useState(false);
  const [pendingReply, setPendingReply] = useState<CheckoutReply | null>(null);
  let connected = false;
  try { connected = JSON.parse(savedProfile ?? "null")?.bankConnected === "true"; } catch { /* start with connection disabled */ }
  const merchant = DEMO_MERCHANTS[merchantId];

  async function verifyPayment(reply: CheckoutReply) {
    setBusy(true); setVerifying(true); setNotice("");
    try {
      for (let attempt = 0; attempt < 8; attempt++) {
        const result = await fetch("/api/payments/razorpay/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: reply.razorpay_order_id, paymentId: reply.razorpay_payment_id, signature: reply.razorpay_signature }) });
        const body = await result.json();
        if (result.ok) { setPendingReply(null); setPaid(true); return; }
        if (body.error !== "payment_capture_pending") throw new Error("Could not verify the payment. Check your Razorpay account.");
        if (attempt < 7) await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      setPendingReply(reply);
      setNotice("Payment is still awaiting capture. Check your Razorpay account, then try verification again.");
    } catch {
      setPendingReply(reply);
      setNotice("Could not verify the payment. Please try again.");
    } finally { setBusy(false); setVerifying(false); }
  }

  async function pay() {
    if (busy || !connected) return;
    setBusy(true); setNotice(""); setPaid(false); setPendingReply(null);
    try {
      await loadCheckout();
      const response = await fetch("/api/payments/razorpay/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ merchantId }) });
      const order = await response.json();
      if (!response.ok) throw new Error(order.error === "invalid_origin" ? "Open Fynish and this page using the same address." : order.error || "Could not start the payment.");
      const Razorpay = (window as CheckoutWindow).Razorpay;
      if (!Razorpay) throw new Error("Payment window is unavailable.");
      new Razorpay({
        key: order.keyId, amount: order.amountPaise, currency: order.currency,
        name: merchant.name, description: "Fynish simulation payment", order_id: order.orderId,
        modal: { ondismiss: () => setBusy(false) },
        handler: (reply) => { void verifyPayment(reply); },
      }).open();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not open checkout."); setBusy(false); }
  }

  return <main className="payment-portal">
    <header className="payment-header"><Link href="/"><Wordmark className="text-3xl" /></Link><Link href="/transactions">Transaction history ↗</Link></header>
    <section className="payment-content merchant-content">
      <div className="merchant-intro"><div><p className="payment-eyebrow">MERCHANT PAYMENTS</p><h1>Make a payment</h1><p className="payment-lead">Choose a merchant and continue to Razorpay checkout.</p></div><span className="merchant-mode">Simulation</span></div>
      {!connected ? <div className="payment-card"><h2>Enable payment alerts first</h2><p>Turn on checkout alerts in transaction history to continue.</p><Link className="payment-button" href="/transactions">Open transaction history <span>→</span></Link></div> :
        <div className="merchant-layout">
          <div className="payment-card merchant-selection">
            <div className="merchant-section-heading"><div><p className="merchant-step">01 / MERCHANT</p><h2>Who are you paying?</h2><p>Select a merchant to see the payment details.</p></div></div>
            <fieldset className="merchant-options" disabled={busy}>
              <legend className="sr-only">Choose a merchant</legend>
              {(Object.values(DEMO_MERCHANTS)).map((item) => <label key={item.id} className={`merchant-option ${merchantId === item.id ? "is-selected" : ""}`}>
                <input type="radio" name="merchant" value={item.id} checked={merchantId === item.id} onChange={() => { setMerchantId(item.id); setPaid(false); setPendingReply(null); setNotice(""); }} />
                <span className="merchant-option-icon" aria-hidden="true">{item.category === "hospital" ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V8h16v12M9 8V4h6v4M2 20h20M12 11v6m-3-3h6" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10c0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0M9 20v-6h6v6" /></svg>}</span>
                <span className="merchant-option-copy"><strong>{item.name}</strong><small>{item.category === "hospital" ? "Hospital" : "Retail store"}</small></span>
                <span className="merchant-option-amount">₹{(item.amountPaise / 100).toLocaleString("en-IN")}</span>
                <span className="merchant-radio" aria-hidden="true" />
              </label>)}
            </fieldset>
            {merchantId === "hospital" && <p className="merchant-bill-link"><a href="/demo/apollo-sample-bill.pdf" download>Download the sample hospital bill</a><span>Attach it separately in chat for a claim check.</span></p>}
          </div>
          <aside className="payment-card merchant-review" aria-label="Payment summary">
            <p className="merchant-step">02 / REVIEW</p><h2>Payment details</h2>
            <div className="merchant-review-row"><span>Paying</span><strong>{merchant.name}</strong></div>
            <div className="merchant-review-row"><span>Payment type</span><strong>{merchant.category === "hospital" ? "Hospital bill" : "Merchant purchase"}</strong></div>
            <div className="merchant-total"><span>Total amount</span><strong>₹{(merchant.amountPaise / 100).toLocaleString("en-IN")}</strong></div>
            <button type="button" className="payment-button" disabled={busy} onClick={() => void pay()}>{verifying ? "Verifying payment…" : busy ? "Opening checkout…" : "Continue to payment"} <span aria-hidden="true">→</span></button>
            <p className="merchant-security"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></svg><span>Payment details are entered in Razorpay’s hosted checkout.</span></p>
            <p className="merchant-disclosure">Simulation only. No real money moves, and Fynish does not receive card numbers.</p>
            {paid && <p className="payment-success" role="status">{merchant.category === "hospital" ? "Payment verified. Check the open Fynish tab for your alert." : "Payment verified. It will appear in transaction history without a hospital alert."}</p>}
            {notice && <p className="payment-error" role="alert">{notice}</p>}
            {pendingReply && !busy && <button type="button" className="payment-button" onClick={() => void verifyPayment(pendingReply)}>Retry verification <span>→</span></button>}
          </aside>
        </div>}
    </section>
  </main>;
}
