import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), sameOrigin: vi.fn(), revoke: vi.fn() }));
vi.mock("@/lib/provider/origin", () => ({ sameOrigin: mocks.sameOrigin }));
vi.mock("@/lib/provider/server", () => ({ revokeConnection: mocks.revoke }));
vi.mock("@/lib/provider/session", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/provider/session")>(),
  readSessionId: mocks.session,
}));
import { POST } from "./route";

const request = () => new Request("http://localhost/api/provider/logout", { method: "POST" });
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockReturnValue("session-1"); mocks.sameOrigin.mockReturnValue(true); mocks.revoke.mockResolvedValue(undefined); });

describe("logout", () => {
  it("clears cookies even when there is no active session", async () => {
    mocks.session.mockReturnValue(null);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(response.cookies.get("fynish_demo_session")?.maxAge).toBe(0);
    expect(response.cookies.get("fynish_provider_auth")?.maxAge).toBe(0);
  });

  it("revokes the current connection and expires both cookies", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.revoke).toHaveBeenCalledWith("session-1");
    expect(response.cookies.get("fynish_demo_session")?.maxAge).toBe(0);
    expect(response.cookies.get("fynish_provider_auth")?.maxAge).toBe(0);
    expect(await response.json()).toEqual({ signedOut: true, connectionRevoked: true });
  });

  it("expires cookies and reports a failed revocation", async () => {
    mocks.revoke.mockRejectedValue(new Error("unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.cookies.get("fynish_demo_session")?.maxAge).toBe(0);
    expect(response.cookies.get("fynish_provider_auth")?.maxAge).toBe(0);
    expect(await response.json()).toEqual({ signedOut: true, connectionRevoked: false });
  });

  it("rejects cross-origin logout without revoking anything", async () => {
    mocks.sameOrigin.mockReturnValue(false);
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(mocks.revoke).not.toHaveBeenCalled();
  });
});
