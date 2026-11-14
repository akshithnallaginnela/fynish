import { afterEach, describe, expect, it, vi } from "vitest";
import { razorpayRequest } from "./razorpay";

describe("Razorpay connectivity", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("explains when the server cannot reach the payment provider", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_example");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "example");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(razorpayRequest("/orders")).rejects.toMatchObject({
      status: 502, message: "Cannot reach the payment provider. Check the server's internet access and try again.",
    });
  });

  it("distinguishes a timed out provider request", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_example");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "example");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")));
    await expect(razorpayRequest("/orders")).rejects.toMatchObject({
      status: 504, message: "The payment provider took too long to respond. Please try again.",
    });
  });
});
