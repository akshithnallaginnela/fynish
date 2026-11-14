import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), query: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/provider/session", () => ({ readSessionId: mocks.session }));
vi.mock("@/lib/db", () => ({
  db: { from: () => ({ select: () => {
    const chain = { eq: (...args: unknown[]) => { mocks.eq(...args); return chain; }, maybeSingle: mocks.query };
    return chain;
  } }) },
}));
import { GET } from "./route";

const id = "28b4324d-e97f-4698-a695-70b1943e48ce";
const request = () => new Request(`http://localhost/api/claim/review?journeyId=${id}`);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockReturnValue("session-1");
});

describe("claim review access", () => {
  it("requires a signed session before querying", async () => {
    mocks.session.mockReturnValue(null);
    expect((await GET(request())).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("scopes the claim lookup to the current session and conceals missing records", async () => {
    mocks.query.mockResolvedValue({ data: null, error: null });
    expect((await GET(request())).status).toBe(404);
    expect(mocks.eq).toHaveBeenCalledWith("customer_id", "session-1");
    expect(mocks.eq).toHaveBeenCalledWith("id", id);
  });

  it("returns only review fields from the session's stored assessment", async () => {
    mocks.query.mockResolvedValue({ data: {
      id, extracted: { bill: { total: 42000 }, receipt: "private" }, claim_id: null,
      assessment: { readiness: { score: 74 }, amountSummary: { total: 42000 }, citations: [], warnings: [], policySnapshot: "private" },
    }, error: null });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toEqual({ journeyId: id, bill: { total: 42000 }, readiness: { score: 74 }, amountSummary: { total: 42000 }, citations: [], warnings: [] });
  });
});
