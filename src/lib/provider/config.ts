import type { ProviderId } from "./types";

const bases: Record<ProviderId, string> = {
  star: process.env.STAR_MOCK_URL || "http://127.0.0.1:4101",
  "hdfc-ergo": process.env.HDFC_ERGO_MOCK_URL || "http://127.0.0.1:4102",
};

export function providerBase(provider: ProviderId) {
  const url = new URL(bases[provider]);
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("Provider mock URL must be an origin");
  }
  return url.origin;
}

export function appOrigin() {
  const url = new URL(process.env.FYNISH_BASE_URL || "http://127.0.0.1:3000");
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("FYNISH_BASE_URL must be an origin");
  }
  return url.origin;
}

export function callbackUrl() {
  return `${appOrigin()}/api/provider/callback`;
}
