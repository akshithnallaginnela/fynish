"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ONBOARDING_KEY } from "@/lib/onboarding";

type Profile = { name?: string; provider?: string; bankConnected?: string };
type InsurerSession = { connected: boolean; provider?: "star" | "hdfc-ergo" };
const subscribe = (callback: () => void) => { window.addEventListener("storage", callback); return () => window.removeEventListener("storage", callback); };
const snapshot = () => { try { return localStorage.getItem(ONBOARDING_KEY); } catch { return null; } };

export async function logoutAccount(): Promise<"complete" | "provider-revocation-failed" | "local-storage-failed"> {
  const response = await fetch("/api/provider/logout", { method: "POST" });
  const result = await response.json().catch(() => null) as { signedOut?: boolean; connectionRevoked?: boolean } | null;
  if (!result?.signedOut) throw new Error("Sign out could not finish. Please try again.");
  try { localStorage.removeItem(ONBOARDING_KEY); } catch { return "local-storage-failed"; }
  return result.connectionRevoked ? "complete" : "provider-revocation-failed";
}

export default function AccountSettings({ onChangeProvider, onManagePayments }: { onChangeProvider: () => void; onManagePayments: () => void }) {
  const router = useRouter();
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  let profile: Profile = {};
  try { profile = JSON.parse(raw ?? "null") ?? {}; } catch { /* Use an empty profile when storage is unavailable. */ }
  const [insurer, setInsurer] = useState<InsurerSession | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [partialLogout, setPartialLogout] = useState<"provider-revocation-failed" | "local-storage-failed" | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/provider/session", { cache: "no-store" }).then((response) => response.ok ? response.json() : null)
      .then((value: InsurerSession | null) => { if (active) setInsurer(value); }).catch(() => {});
    return () => { active = false; };
  }, []);

  function saveName() {
    const value = name.trim();
    if (!value || !raw) return;
    try {
      const current = JSON.parse(raw) as Record<string, unknown>;
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ ...current, name: value }));
      window.dispatchEvent(new Event("storage"));
      setEditing(false);
      setError("");
    } catch { setError("Could not save your name on this device."); }
  }

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await logoutAccount();
      if (result !== "complete") {
        setPartialLogout(result);
        setError(result === "provider-revocation-failed" ? "Signed out on this device, but the insurer connection could not be revoked. Please contact support." : "Signed out of the session, but the profile could not be removed from this browser. Clear this site's stored data in your browser settings.");
        return;
      }
      window.dispatchEvent(new Event("storage"));
      router.replace("/welcome");
    } catch {
      setError("Sign out could not finish. Please check your connection and try again.");
    } finally { setBusy(false); }
  }

  const insurerName = insurer?.connected ? (insurer.provider === "star" ? "Star Health" : "HDFC ERGO") : insurer ? "Not connected" : "Unavailable";
  return <section aria-label="Account settings" className="w-full max-w-2xl rounded-2xl border border-line bg-card p-5 sm:p-6">
    <h2 className="text-lg font-bold text-ink">Account settings</h2>
    <p className="mt-2 text-sm leading-6 text-ink-2">Manage your profile and connections on this device.</p>
    <div className="mt-5 divide-y divide-line rounded-xl border border-line bg-white px-4">
      <div className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="text-xs font-semibold text-ink-3">Name</p>{editing ? <label className="mt-2 block"><span className="sr-only">Your name</span><input className="min-h-10 w-full rounded-lg border border-line px-3 text-sm" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} /></label> : <p className="mt-1 text-sm font-bold text-ink">{profile.name || "Not set"}</p>}</div>{editing ? <div className="flex gap-3"><button type="button" disabled={!name.trim()} onClick={saveName} className="text-sm font-semibold text-blue disabled:opacity-40">Save</button><button type="button" onClick={() => setEditing(false)} className="text-sm font-semibold text-ink-2">Cancel</button></div> : <button type="button" onClick={() => { setName(profile.name ?? ""); setEditing(true); }} className="text-sm font-semibold text-blue">Edit</button>}</div>
      <div className="flex items-center justify-between gap-3 py-4"><div><p className="text-xs font-semibold text-ink-3">Insurance provider</p><p className="mt-1 text-sm font-bold text-ink">{insurerName}</p></div><button type="button" onClick={onChangeProvider} className="text-sm font-semibold text-blue">Manage</button></div>
      <div className="flex items-center justify-between gap-3 py-4"><div><p className="text-xs font-semibold text-ink-3">Checkout payment alerts</p><p className="mt-1 text-sm font-bold text-ink">{profile.bankConnected === "true" ? "On" : "Off"}</p></div><button type="button" onClick={onManagePayments} className="text-sm font-semibold text-blue">Manage</button></div>
    </div>
    <p className="mt-5 text-xs leading-5 text-ink-3">Your chats remain on this device after sign out. Previously uploaded claim details belong to this session and cannot be reopened after signing out.</p>
    {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
    {partialLogout === "provider-revocation-failed" ? <button type="button" onClick={() => { window.dispatchEvent(new Event("storage")); router.replace("/welcome"); }} className="mt-4 rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink">Continue to welcome</button> : !partialLogout && <button type="button" disabled={busy} onClick={() => void signOut()} className="mt-4 rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink disabled:opacity-50">{busy ? "Signing out…" : "Sign out"}</button>}
  </section>;
}
