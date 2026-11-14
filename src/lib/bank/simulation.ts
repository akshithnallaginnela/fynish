import { NextResponse } from "next/server";
import { open, seal } from "@/lib/provider/crypto";
import { readSessionId } from "@/lib/provider/session";

const BANK_COOKIE = "fynish_simulated_bank";
export const simulatedBankAccount = {
  id: "fynish-sample-1",
  bankName: "Payment account",
  accountHolder: "Ravi Kumar",
  accountNumberMasked: "•••• 4721",
  accountType: "Savings",
} as const;

export const simulatedTransactions = [
  { id: "sample-hospital-1", merchantName: "Apollo Hospitals", amountPaise: 4_200_000, paidAt: "2026-11-10T10:30:00.000Z", method: "UPI" },
  { id: "sample-market-1", merchantName: "City Market", amountPaise: 50_000, paidAt: "2026-11-09T12:00:00.000Z", method: "UPI" },
  { id: "sample-pharmacy-1", merchantName: "City Pharmacy", amountPaise: 125_000, paidAt: "2026-11-08T09:15:00.000Z", method: "UPI" },
] as const;

// The connection is fictional and tied to the current browser session. Replace
// this cookie with revocable server-side consent when a real provider is added.
export function simulatedBankConnected(request: Request) {
  const sessionId = readSessionId(request);
  if (!sessionId) return false;
  const cookie = (request.headers.get("cookie") ?? "").split(";").map((value) => value.trim())
    .find((value) => value.startsWith(`${BANK_COOKIE}=`));
  if (!cookie) return false;
  try { return open(decodeURIComponent(cookie.slice(BANK_COOKIE.length + 1)), "simulated-bank") === sessionId; }
  catch { return false; }
}

export function setSimulatedBankCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(BANK_COOKIE, seal(sessionId, "simulated-bank"), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24,
  });
}

export function clearSimulatedBankCookie(response: NextResponse) {
  response.cookies.set(BANK_COOKIE, "", {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0,
  });
}
