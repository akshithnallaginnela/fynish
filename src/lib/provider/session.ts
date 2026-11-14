import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { open, seal } from "./crypto";

export const SESSION_COOKIE = "fynish_demo_session";
export const AUTH_COOKIE = "fynish_provider_auth";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cookieValue(request: Request, name: string) {
  const raw = request.headers.get("cookie") || "";
  const item = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!item) return null;
  try { return decodeURIComponent(item.slice(name.length + 1)); }
  catch { return null; }
}

export function readSessionId(request: Request) {
  const value = cookieValue(request, SESSION_COOKIE);
  if (!value) return null;
  try {
    const id = open(value, "session");
    return UUID.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function sessionIdFor(request: Request) {
  return readSessionId(request) || randomUUID();
}

export function setSessionCookie(response: NextResponse, id: string) {
  response.cookies.set(SESSION_COOKIE, seal(id, "session"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function readAuthCookie(request: Request) {
  const value = cookieValue(request, AUTH_COOKIE);
  if (!value) return null;
  try {
    return JSON.parse(open(value, "auth")) as unknown;
  } catch {
    return null;
  }
}

export function setAuthCookie(response: NextResponse, value: object) {
  response.cookies.set(AUTH_COOKIE, seal(JSON.stringify(value), "auth"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/provider",
    maxAge: 300,
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/provider",
    maxAge: 0,
  });
}
