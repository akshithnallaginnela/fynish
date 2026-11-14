import { createHmac, timingSafeEqual } from "node:crypto";

export class RazorpayError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new RazorpayError(503, "Payment simulation is not configured.");
  if (!keyId.startsWith("rzp_test_")) throw new RazorpayError(503, "Payment simulation requires test-mode credentials.");
  return { keyId, keySecret };
}

export async function razorpayRequest(path: string, init?: RequestInit) {
  const { keyId, keySecret } = credentials();
  let response: Response;
  try {
    response = await fetch(`https://api.razorpay.com/v1${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        ...init?.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new RazorpayError(502, "Payment service did not respond. Try again.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof body?.error?.description === "string" ? body.error.description : "Payment request could not be completed.";
    throw new RazorpayError(response.status >= 500 ? 502 : 400, detail);
  }
  return body as unknown;
}

export function razorpayKeyId() {
  return credentials().keyId;
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const { keySecret } = credentials();
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "hex"); } catch { return false; }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyWebhookSignature(body: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new RazorpayError(503, "Payment notifications are not configured yet.");
  const expected = createHmac("sha256", secret).update(body).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "hex"); } catch { return false; }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
