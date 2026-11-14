import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchPayment: vi.fn(),
  signature: vi.fn(),
  getOrder: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/provider/http", () => ({ sameOrigin: () => true }));
vi.mock("@/lib/provider/session", () => ({ readSessionId: () => "session-1" }));
vi.mock("@/lib/razorpay", () => ({ razorpayRequest: mocks.fetchPayment, verifyCheckoutSignature: mocks.signature, RazorpayError: class extends Error {} }));
vi.mock("@/lib/db", () => ({
  db: { from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: mocks.getOrder }) }),
    update: (values: unknown) => { mocks.update(values); return { eq: () => ({ eq: async () => ({ error: null }) }) }; },
  }) },
}));

import { POST } from "./route";

const request = () => new Request("http://localhost/api/payments/razorpay/verify", {
  method: "POST", body: JSON.stringify({ orderId: "order_12345678", paymentId: "pay_12345678", signature: "a".repeat(64) }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signature.mockReturnValue(true);
  mocks.getOrder.mockResolvedValue({ data: { order_id: "order_12345678", session_id: "session-1", amount_paise: 4200000, hospital_name: "Hospital", status: "created" }, error: null });
});

describe("test checkout verification", () => {
  it("waits when the payment has only been authorized", async () => {
    mocks.fetchPayment.mockResolvedValue({ id: "pay_12345678", order_id: "order_12345678", amount: 4200000, status: "authorized" });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "payment_capture_pending" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects a captured payment with a different amount", async () => {
    mocks.fetchPayment.mockResolvedValue({ id: "pay_12345678", order_id: "order_12345678", amount: 50000, status: "captured" });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "payment_details_mismatch" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("marks a verified captured payment paid", async () => {
    mocks.fetchPayment.mockResolvedValue({ id: "pay_12345678", order_id: "order_12345678", amount: 4200000, status: "captured", method: "upi" });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: "paid", payment_id: "pay_12345678", payment_method: "upi" }));
  });

  it("rejects an invalid signature before fetching or updating", async () => {
    mocks.signature.mockReturnValue(false);
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(mocks.fetchPayment).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects another session's order before fetching or updating", async () => {
    mocks.getOrder.mockResolvedValue({ data: { order_id: "order_12345678", session_id: "another-session", amount_paise: 4200000, hospital_name: "Hospital", status: "created" }, error: null });
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(mocks.fetchPayment).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
