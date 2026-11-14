import { describe, expect, it } from "vitest";
import { assessBill } from "./assessment";

const policy = {
  id: "hdfc-demo-policy-001",
  wordingId: "pol_hdfc_demo",
  provider: "hdfc-ergo",
  product: "Synthetic Health Plan",
  policyStart: "2025-08-01",
  continuousCoverSince: "2025-08-01",
  insuredAgeAtEntry: 31,
  sumInsuredPaise: 30_000_000,
  coPayPct: 10,
};

const bill = {
  hospitalName: "Demo Hospital",
  patientName: "Demo Patient",
  admissionDate: "2026-11-10",
  dischargeDate: "2026-11-12",
  roomType: "Single Standard AC",
  roomRentPerDayPaise: 100_000,
  totalAmountPaise: 1_210_000,
  lineItems: [
    { label: "Surgery", amountPaise: 1_000_000 },
    { label: "Room rent", amountPaise: 200_000 },
    { label: "Registration charge", amountPaise: 10_000 },
  ],
  confidence: 0.95,
};

const dischargeSummary = {
  diagnosis: "Appendicitis",
  procedure: "Appendectomy",
  admissionDate: "2026-11-10",
  dischargeDate: "2026-11-12",
  treatingDoctor: null,
  confidence: 0.95,
};
const receipt = { amountPaise: 1_210_000, merchantName: "Demo Hospital", paidAt: "2026-11-12T10:00:00Z", upiRef: "test-payment" };

describe("claim amount assessment", () => {
  it("separates excluded charges and applies the synthetic demo co-pay", () => {
    const result = assessBill({ bill, dischargeSummary, receipt, policy, remainingBalancePaise: 28_000_000, today: "2026-11-13" });
    expect(result.readiness.readyToSubmit).toBe(true);
    expect(result.readiness.breakdown.find((item) => item.ruleId === "R-DOC-RECEIPT-MISSING")?.passed).toBe(true);
    expect(result.amountSummary.items.map((item) => item.status)).toEqual(["covered", "covered", "excluded"]);
    expect(result.amountSummary.estimatedPayablePaise).toBe(1_080_000);
  });

  it("scores a missing payment receipt", () => {
    const result = assessBill({ bill, dischargeSummary, policy, remainingBalancePaise: 28_000_000, today: "2026-11-13" });
    expect(result.readiness.breakdown.find((item) => item.ruleId === "R-DOC-RECEIPT-MISSING")?.passed).toBe(false);
  });

  it("recognizes plural medical bill labels and estimates the payable amount", () => {
    const result = assessBill({
      bill: { ...bill, lineItems: [{ label: "Medicines", amountPaise: 200_000 }, { label: "Diagnostics", amountPaise: 1_010_000 }] },
      dischargeSummary,
      receipt,
      policy,
      remainingBalancePaise: 28_000_000,
      today: "2026-11-13",
    });
    expect(result.amountSummary.items.map((item) => item.status)).toEqual(["covered", "covered"]);
    expect(result.amountSummary.estimatedPayablePaise).toBe(1_089_000);
  });

  it("withholds a numeric estimate when a charge has no matching term", () => {
    const result = assessBill({
      bill: { ...bill, lineItems: [...bill.lineItems.slice(0, 2), { label: "Miscellaneous fee", amountPaise: 10_000 }] },
      dischargeSummary,
      receipt,
      policy,
      remainingBalancePaise: 28_000_000,
      today: "2026-11-13",
    });
    expect(result.amountSummary.items[2].status).toBe("review");
    expect(result.amountSummary.estimatedPayablePaise).toBeNull();
  });
});
