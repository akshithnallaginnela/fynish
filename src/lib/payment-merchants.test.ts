import { describe, expect, it } from "vitest";
import { classifyDemoMerchant } from "./payment-merchants";

describe("demo merchant classification", () => {
  it("recognizes the hospital and keeps non-health merchants separate", () => {
    expect(classifyDemoMerchant("Apollo Hospitals")?.category).toBe("hospital");
    expect(classifyDemoMerchant("City Market")?.category).toBe("other");
  });

  it("does not classify an unknown merchant by a partial name match", () => {
    expect(classifyDemoMerchant("Apollo Hospitals Store")).toBeNull();
  });
});
