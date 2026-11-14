"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Wordmark from "@/components/wordmark";
import SimulatedBankConnect, { type BankSession, type BankTransaction } from "@/components/simulated-bank-connect";
import "./payment-portal.css";

export type TransactionSignal = {
  orderId: string;
  hospitalName: string;
  amountPaise: number;
  paymentId: string | null;
  paidAt: string | null;
  category: "hospital" | "other" | "unknown";
  seen: boolean;
};
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Recent";

export default function TransactionHistory({ embedded = false, onCheckPayment, onCheckBankTransaction }: {
  embedded?: boolean;
  onCheckPayment?: (signal: TransactionSignal) => void;
  onCheckBankTransaction?: (transaction: BankTransaction) => void;
} = {}) {
  const [session, setSession] = useState<BankSession | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [payments, setPayments] = useState<TransactionSignal[]>([]);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [bankError, setBankError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      fetch("/api/bank/session", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json() as Promise<BankSession>;
      }).then((result) => { if (active) { setSession(result); setBankError(""); } })
        .catch(() => { if (active) setBankError("Could not load your bank connection. Please try again."); });
    };
    refresh();
    window.addEventListener("fynish:bank-connection-changed", refresh);
    return () => { active = false; window.removeEventListener("fynish:bank-connection-changed", refresh); };
  }, [retryKey]);

  useEffect(() => {
    if (!session?.connected) return;
    let active = true;
    const refresh = () => {
      fetch("/api/bank/transactions", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json() as Promise<{ transactions: BankTransaction[] }>;
      }).then((result) => { if (active) { setTransactions(Array.isArray(result.transactions) ? result.transactions : []); setBankError(""); } })
        .catch(() => { if (active) setBankError("Could not load bank transactions. Please try again."); });
      fetch("/api/payment-feed", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json() as Promise<{ signals: TransactionSignal[] }>;
      }).then((result) => { if (active) { setPayments(Array.isArray(result.signals) ? result.signals : []); setPaymentError(""); } })
        .catch(() => { if (active) setPaymentError("Could not load payment notifications. Please try again."); });
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [session?.connected, retryKey]);

  const notifications = payments.filter((payment) => !payment.seen);

  async function dismiss(orderId: string) {
    try {
      const response = await fetch("/api/payment-feed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId }) });
      if (!response.ok) throw new Error("unavailable");
      setPayments((current) => current.map((payment) => payment.orderId === orderId ? { ...payment, seen: true } : payment));
    } catch { setPaymentError("Could not dismiss the notification. Please try again."); }
  }

  const claimLink = (kind: "bank" | "checkout", id: string) => kind === "bank"
    ? `/?bankTransaction=${encodeURIComponent(id)}`
    : `/?paymentOrderId=${encodeURIComponent(id)}`;
  const bankAction = (transaction: BankTransaction) => onCheckBankTransaction
    ? <button type="button" className="transaction-claim" onClick={() => onCheckBankTransaction(transaction)}>Ask about payment</button>
    : <Link className="transaction-claim" href={claimLink("bank", transaction.id)}>Ask about payment</Link>;
  const paymentAction = (payment: TransactionSignal) => onCheckPayment
    ? <button type="button" className="transaction-claim" onClick={() => onCheckPayment(payment)}>Check claim</button>
    : <Link className="transaction-claim" href={claimLink("checkout", payment.orderId)}>Check claim</Link>;

  const content = <>
    <section className="transactions-account" aria-label="Bank connection">
      <div>
        <span className="transactions-label">BANK CONNECTION</span>
        <h2>{session?.connected ? session.account?.bankName ?? "Account connected" : "Connect your account"}</h2>
        <p>{session?.connected ? "Simulated connection · Fictional transactions" : "Connect your bank to view transactions. This connection is simulated."}</p>
      </div>
      <button type="button" onClick={() => setConnectionOpen(true)} disabled={!session} className="transactions-connect">{session?.connected ? "Manage account" : "Connect bank"}</button>
    </section>
    {bankError && <p role="alert" className="payment-error">{bankError} <button type="button" className="font-semibold underline" onClick={() => setRetryKey((current) => current + 1)}>Retry</button></p>}

    {session?.connected && <>
      <section className="transactions-section" aria-label="Notifications">
        <div className="transactions-heading"><div><span className="transactions-label">UPDATES</span><h2>Notifications</h2></div><span>{notifications.length}</span></div>
        {paymentError && <p role="alert" className="payment-error">{paymentError}</p>}
        {notifications.length === 0 ? <p className="transactions-empty">No new notifications.</p> : <div className="transactions-alerts">
          {notifications.map((payment) => <article key={payment.orderId} className="transactions-alert">
            <div><strong>New payment</strong><p>{payment.hospitalName} · {money(payment.amountPaise)}</p><small>Ask about this payment and check your policy.</small></div>
            <div className="transactions-alert-actions">{paymentAction(payment)}<button type="button" onClick={() => void dismiss(payment.orderId)}>Dismiss</button></div>
          </article>)}
        </div>}
      </section>

      <section className="transactions-section" aria-label="Transaction history">
        <div className="transactions-heading"><div><span className="transactions-label">YOUR ACTIVITY</span><h2>Transaction history</h2></div></div>
        <p className="transactions-source">The bank feed shows the payee, date and amount. Add a bill to check whether a payment relates to a claim.</p>
        <h3 className="transactions-subheading">Bank transactions</h3>
        {transactions.length === 0 ? <p className="transactions-empty">No bank transactions to show.</p> : <ul className="transactions-list">{transactions.map((transaction) => <li key={transaction.id}>
          <span className="transactions-icon" aria-hidden="true">₹</span>
          <div className="transactions-detail"><strong>{transaction.merchantName}</strong><small>{transaction.method} · {date(transaction.paidAt)}</small></div>
          <div className="transactions-amount"><strong>{money(transaction.amountPaise)}</strong>{bankAction(transaction)}</div>
        </li>)}</ul>}
        {payments.length > 0 && <><h3 className="transactions-subheading">Checkout payments</h3><ul className="transactions-list">{payments.map((payment) => <li key={payment.orderId}>
          <span className="transactions-icon" aria-hidden="true">₹</span>
          <div className="transactions-detail"><strong>{payment.hospitalName}</strong><small>Checkout · {date(payment.paidAt)}</small></div>
          <div className="transactions-amount"><strong>{money(payment.amountPaise)}</strong>{paymentAction(payment)}</div>
        </li>)}</ul></>}
      </section>
    </>}
    {connectionOpen && <div className="transactions-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConnectionOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setConnectionOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="bank-connection-title" className="transactions-modal">
        <div className="transactions-modal-heading"><h2 id="bank-connection-title">Bank connection</h2><button type="button" aria-label="Close bank connection" onClick={() => setConnectionOpen(false)}>×</button></div>
        <SimulatedBankConnect session={session} onChange={(next) => { setSession(next); if (!next.connected) { setTransactions([]); setPayments([]); } else setConnectionOpen(false); }} />
      </section>
    </div>}
  </>;

  if (embedded) return <section aria-label="Transaction history" className="w-full max-w-2xl">{content}</section>;
  return <main className="payment-portal transactions-page"><header className="payment-header"><Link href="/"><Wordmark className="text-3xl" /></Link><Link href="/">Back to chat ↗</Link></header><div className="transactions-content"><p className="payment-eyebrow">YOUR ACTIVITY</p><h1>Transactions</h1><p className="transactions-intro">Review your payments and check them against your cover.</p>{content}</div></main>;
}
