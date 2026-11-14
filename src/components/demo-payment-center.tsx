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
    <header className="payment-header"><Link href="/"><Wordmark className="text-3xl" /></Link><span>Fynish simulation</span></header>
    <section className="payment-content">
      <p className="payment-eyebrow">SIMULATION CHECKOUT</p>
      <h1>Pay a merchant.</h1>
      <p className="payment-lead">Keep Fynish open in another tab. A verified hospital payment can start a claim check there.</p>
      {!connected ? <div className="payment-card"><h2>Enable payment alerts first</h2><p>Open transaction history in Fynish to enable checkout alerts.</p><Link className="payment-button" href="/transactions">Open transaction history <span>→</span></Link></div> :
        <div className="payment-card">
          <label className="payment-label" htmlFor="sample-merchant">Choose a merchant</label>
          <select id="sample-merchant" value={merchantId} disabled={busy} onChange={(event) => { setMerchantId(event.target.value as DemoMerchantId); setPaid(false); setPendingReply(null); setNotice(""); }}>
            <option value="hospital">Apollo Hospitals · ₹42,000</option>
            <option value="store">City Market · ₹500</option>
          </select>
          <div className="payment-summary"><span>Amount</span><strong>₹{(merchant.amountPaise / 100).toLocaleString("en-IN")}</strong></div>
          <button type="button" className="payment-button" disabled={busy} onClick={() => void pay()}>{verifying ? "Verifying payment…" : busy ? "Opening checkout…" : "Continue to payment"} <span>→</span></button>
          <p className="payment-note">Simulation only. Enter card details in the payment provider’s hosted checkout; Fynish does not receive card numbers or move real money.</p>
          {merchantId === "hospital" && <p className="payment-note"><a href="/demo/apollo-sample-bill.pdf" download>Download the sample hospital bill</a>. It is not attached automatically and cannot be used for a real claim.</p>}
          {paid && <p className="payment-success" role="status">{merchant.category === "hospital" ? "Payment verified. Check the open Fynish tab for your alert." : "Payment verified. It will appear in transaction history without a hospital alert."}</p>}
          {notice && <p className="payment-error" role="alert">{notice}</p>}
          {pendingReply && !busy && <button type="button" className="payment-button" onClick={() => void verifyPayment(pendingReply)}>Retry verification <span>→</span></button>}
        </div>}
    </section>
  </main>;
}
