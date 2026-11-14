"use client";

import { useEffect, useRef, useState } from "react";
import "./transaction-notifications.css";

export type PaymentNotification = {
  orderId: string;
  hospitalName: string;
  amountPaise: number;
  paidAt: string | null;
  seen: boolean;
  category: "hospital" | "other" | "unknown";
};

const amount = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);

export function newlyArrivedPayments(all: PaymentNotification[], previous: Set<string> | null) {
  return previous ? all.filter((item) => !item.seen && !previous.has(item.orderId)).reverse() : [];
}

export default function TransactionNotifications({ onOpenTransaction, disabled = false }: {
  onOpenTransaction: (payment: PaymentNotification) => void;
  disabled?: boolean;
}) {
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<PaymentNotification[]>([]);
  const [queue, setQueue] = useState<PaymentNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const known = useRef<Set<string> | null>(null);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      fetch("/api/bank/session", { cache: "no-store" }).then((response) => response.ok ? response.json() : null)
        .then((body) => { if (active) { setConnected(body?.connected === true); if (!body?.connected) { setQueue([]); setNotifications([]); } } })
        .catch(() => { if (active) setError("Could not refresh account connection."); });
    };
    refresh();
    window.addEventListener("fynish:bank-connection-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("fynish:bank-connection-changed", refresh); window.removeEventListener("focus", refresh); };
  }, []);

  useEffect(() => {
    if (!connected) { known.current = null; return; }
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch("/api/payment-feed", { cache: "no-store" });
        if (!response.ok) throw new Error("unavailable");
        const body = await response.json() as { signals?: PaymentNotification[] };
        if (!active) return;
        const all = Array.isArray(body.signals) ? body.signals : [];
        const previous = known.current;
        const next = new Set(all.map((item) => item.orderId));
        if (previous) {
          const arrived = newlyArrivedPayments(all, previous);
          if (arrived.length) setQueue((current) => [...current, ...arrived]);
        }
        known.current = next;
        setNotifications(all.filter((item) => !item.seen));
        setError("");
      } catch {
        if (active) setError("Could not refresh notifications.");
      } finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [connected]);

  const currentQueueId = queue[0]?.orderId;
  useEffect(() => {
    if (!currentQueueId) return;
    const timer = window.setTimeout(() => setQueue((current) => current.slice(1)), 4000);
    return () => window.clearTimeout(timer);
  }, [currentQueueId]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  async function markSeen(payment: PaymentNotification, startChat: boolean) {
    if (disabled && startChat) return;
    setOpen(false);
    setQueue((current) => current.filter((item) => item.orderId !== payment.orderId));
    if (startChat) onOpenTransaction(payment);
    try {
      const response = await fetch("/api/payment-feed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: payment.orderId }) });
      if (!response.ok) throw new Error("unavailable");
      setNotifications((current) => current.filter((item) => item.orderId !== payment.orderId));
      setError("");
    } catch { setError("Could not update this notification. Try again."); }
  }

  const current = connected ? queue[0] : undefined;
  const visible = connected ? notifications : [];
  return <div ref={container} className="notification-wrap">
    <button type="button" className="notification-bell" aria-label={`Notifications${visible.length ? `, ${visible.length} unread` : ""}`} aria-expanded={open} aria-controls="payment-notifications" onClick={() => setOpen((value) => !value)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-2 7-2 9h16c0-2-2-2-2-9M10 20h4" /></svg>
      {visible.length > 0 && <span className="notification-badge" aria-hidden="true">{visible.length > 9 ? "9+" : visible.length}</span>}
    </button>
    {open && <section id="payment-notifications" aria-label="Notifications" className="notification-menu">
      <div className="notification-heading"><strong>Notifications</strong><span>{visible.length} new</span></div>
      {!connected ? <p className="notification-empty">Connect your account to see payment notifications.</p> : !visible.length ? <p className="notification-empty">No new notifications.</p> : <ul className="notification-list">{visible.map((payment) => <li key={payment.orderId}>
        <button type="button" disabled={disabled} onClick={() => void markSeen(payment, true)} className="notification-item"><strong>{payment.hospitalName}</strong><span>{amount(payment.amountPaise)} · Ask about payment</span></button>
        <button type="button" onClick={() => void markSeen(payment, false)} className="notification-dismiss" aria-label={`Dismiss ${payment.hospitalName} notification`}>×</button>
      </li>)}</ul>}
      {error && <p role="status" className="notification-error">{error}</p>}
    </section>}
    {current && <div className="notification-toast" role="status" aria-live="polite">
      <button type="button" disabled={disabled} onClick={() => void markSeen(current, true)}><span className="notification-toast-label">New payment</span><strong>{current.hospitalName}</strong><span>{amount(current.amountPaise)} · Ask about payment</span></button>
      <button type="button" className="notification-toast-close" aria-label="Close popup" onClick={() => setQueue((items) => items.slice(1))}>×</button>
    </div>}
  </div>;
}
