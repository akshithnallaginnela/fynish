import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ claim: vi.fn(), policy: vi.fn(), session: vi.fn() }));
vi.mock("@/lib/assistant/claim-context", () => ({ getClaimContext: mocks.claim }));
vi.mock("@/lib/provider/server", () => ({ getSelectedPolicyForRequest: mocks.policy }));
vi.mock("@/lib/provider/session", () => ({ readSessionId: mocks.session }));

import { POST } from "./route";

const journeyId = "00000000-0000-4000-8000-000000000001";
const request = (body: unknown) => new Request("http://localhost/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("assistant claim context", () => {
  beforeEach(() => {
    vi.stubEnv("OLLAMA_BASE_URL", "");
    vi.stubEnv("LLM_BASE_URL", "https://example.test/v1");
    vi.stubEnv("LLM_MODEL", "sample-model");
    mocks.session.mockReturnValue("session");
    mocks.policy.mockResolvedValue(null);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("sends policy and bill facts in the same system message as the claim instructions", async () => {
    mocks.claim.mockResolvedValue('CLAIM_FACT: {"policyCoverRupees":500000,"estimatedPayableRupees":null}');
    const fetchMock = vi.fn().mockResolvedValue(new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n'));
    vi.stubGlobal("fetch", fetchMock);
    const result = await POST(request({ messages: [{ role: "user", content: "Can I claim this bill?" }], journeyId, billAttached: true }));
    expect(result.status).toBe(200);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    const system = sent.messages.filter((message: { role: string }) => message.role === "system");
    expect(system).toHaveLength(1);
    expect(system[0].content).toContain("CLAIM_FACT");
    expect(system[0].content).toContain("projectedRemainingCoverRupees");
    expect(system[0].content).not.toContain("Use general education only");
  });

  it("does not ask the model to guess when a claim context is unavailable", async () => {
    mocks.claim.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await POST(request({ messages: [{ role: "user", content: "Can I claim this bill?" }], journeyId, billAttached: true }));
    expect(result.status).toBe(503);
    expect(await result.json()).toMatchObject({ code: "claim_context_unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
