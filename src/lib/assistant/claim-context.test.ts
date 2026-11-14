import { describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => {
  const filters: Array<[string, string]> = [];
  const api = {
    from: vi.fn(() => api), select: vi.fn(() => api),
    eq: vi.fn((key: string, value: string) => { filters.push([key, value]); return api; }),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })), filters,
  };
  return api;
});
vi.mock("@/lib/db", () => ({ db: query }));

import { formatClaimContext, getClaimContext } from "./claim-context";

describe("claim context", () => {
  it("scopes lookup to the signed-in session", async () => {
    await getClaimContext("claim-id", "my-session");
    expect(query.filters).toContainEqual(["id", "claim-id"]);
    expect(query.filters).toContainEqual(["customer_id", "my-session"]);
    expect(query.filters).toContainEqual(["type", "claim"]);
  });

  it("reports a provisional assessment without exposing patient details or inventing an estimate", () => {
    const context = formatClaimContext({
      state: "scoring",
      extracted: { bill: { hospitalName: "Demo Hospital", patientName: "Private Person", totalAmountPaise: 4200000, admissionDate: "2026-11-01", dischargeDate: "2026-11-02" } },
      assessment: {
        readiness: { score: 74, readyToSubmit: false, breakdown: [{ passed: false, reason: "Receipt missing", clauseRefs: [] }] },
        amountSummary: { claimedAmountPaise: 4200000, estimatedPayablePaise: null, items: [{ label: "Surgery", amountPaise: 4200000, status: "review", reason: "Needs review" }] },
        warnings: ["Needs review"], policySnapshot: { product: "Demo Policy" },
      },
    });
    expect(context).toContain('"billTotalRupees":42000');
    expect(context).toContain('"estimatedPayableRupees":null');
    expect(context).toContain("Receipt missing");
    expect(context).not.toContain("Private Person");
    expect(formatClaimContext({})).toBeNull();
  });
});
