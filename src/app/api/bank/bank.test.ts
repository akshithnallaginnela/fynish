import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as connect } from "./connect/route";
import { POST as disconnect } from "./disconnect/route";
import { GET as session } from "./session/route";
import { GET as transactions } from "./transactions/route";
import { sampleBankLogin } from "@/lib/bank/sample-login";

const origin = "http://127.0.0.1:3000";
const request = (path: string, options: RequestInit = {}) => new Request(`${origin}${path}`, options);
const cookieHeader = (response: Response) => response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");

describe("simulated bank connection", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("requires explicit consent and blocks cross-origin requests", async () => {
    vi.stubEnv("FYNISH_BASE_URL", origin);
    const wrongOrigin = await connect(request("/api/bank/connect", { method: "POST", headers: { origin: "https://other.test", "content-type": "application/json" }, body: JSON.stringify({ consent: true, accountId: "fynish-sample-1" }) }));
    expect(wrongOrigin.status).toBe(403);
    const noConsent = await connect(request("/api/bank/connect", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ consent: false, accountId: "fynish-sample-1", ...sampleBankLogin }) }));
    expect(noConsent.status).toBe(400);
    expect(transactions(request("/api/bank/transactions")).status).toBe(401);
  });

  it("does not connect when the sample login is incorrect", async () => {
    vi.stubEnv("FYNISH_BASE_URL", origin);
    const result = await connect(request("/api/bank/connect", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ consent: true, accountId: "fynish-sample-1", ...sampleBankLogin, accessCode: "wrong" }) }));
    expect(result.status).toBe(401);
    expect(result.headers.getSetCookie()).toHaveLength(0);
  });

  it("returns only simulated transactions to the connected session and clears its cookie", async () => {
    vi.stubEnv("FYNISH_BASE_URL", origin);
    vi.stubEnv("PROVIDER_TOKEN_KEY", Buffer.alloc(32, 7).toString("base64"));
    const response = await connect(request("/api/bank/connect", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ consent: true, accountId: "fynish-sample-1", ...sampleBankLogin }) }));
    expect(response.status).toBe(200);
    const cookies = cookieHeader(response);
    const headers = { cookie: cookies };
    expect(await session(request("/api/bank/session", { headers })).json()).toMatchObject({ connected: true, source: "simulation", account: { id: "fynish-sample-1" } });
    const result = await transactions(request("/api/bank/transactions", { headers })).json();
    expect(result.source).toBe("simulation");
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[0]).toMatchObject({ merchantName: "Apollo Hospitals", amountPaise: 4_200_000 });
    const bankOnly = cookies.split("; ").find((part) => part.startsWith("fynish_simulated_bank="))!;
    expect(transactions(request("/api/bank/transactions", { headers: { cookie: bankOnly } })).status).toBe(401);
    const cleared = disconnect(request("/api/bank/disconnect", { method: "POST", headers: { origin, cookie: cookies } }));
    expect(cleared.headers.getSetCookie()[0]).toMatch(/Max-Age=0/i);
    expect(await session(request("/api/bank/session", { headers: { cookie: `${bankOnly.split("=")[0]}=` } })).json()).toMatchObject({ connected: false });
  });
});
