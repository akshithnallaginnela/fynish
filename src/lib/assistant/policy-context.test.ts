import { describe, expect, it } from "vitest";
import { policyContext } from "./policy-context";

describe("policyContext", () => {
  it("reports a connected policy's rupee amounts without personal details", () => {
    const context = policyContext({
      provider: "star",
      policy: {
        id: "private-policy-id", wordingId: "wording", provider: "Star Health",
        product: "Demo Health", policyNumberMasked: "private-number", status: "active",
        policyStart: "2025-01-01", continuousCoverSince: "2025-01-01",
        insuredAgeAtEntry: 30, sumInsuredPaise: 50000000, coPayPct: 10,
        insuredPeople: [{ name: "Private Person", relationship: "self" }],
      },
      balance: { policyId: "private-policy-id", remainingBalancePaise: 42000000, asOf: "2026-11-14" },
    });
    expect(context).toContain('"sumInsuredRupees":500000');
    expect(context).toContain('"remainingBalanceRupees":420000');
    expect(context).toContain('"balanceAsOf":"2026-11-14"');
    expect(context).not.toContain("Private Person");
    expect(context).not.toContain("private-policy-id");
    expect(context).toContain("do not include the full policy wording");
  });

  it("does not invent details when no policy is connected", () => {
    expect(policyContext(null)).toContain("No connected policy details");
  });
});
