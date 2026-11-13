import type { RuleContext } from "@/lib/types";
import { demoPolicy } from "@/policy/profile";

// SYNTHETIC demo case from rules.spec.md: FHO, SI ₹5L, cover 14 months old, appendicitis, deluxe room, ₹42,000.
export const bill = {
  hospitalName: "Demo Hospital",
  patientName: "Demo Patient",
  admissionDate: "2026-11-10",
  dischargeDate: "2026-11-12",
  roomType: "Single Private (deluxe)",
  roomRentPerDayPaise: 800_000,
  totalAmountPaise: 4_200_000,
  lineItems: [],
  confidence: 0.95,
};

export const dischargeSummary = {
  diagnosis: "Acute appendicitis",
  procedure: "Laparoscopic appendectomy",
  admissionDate: "2026-11-10",
  dischargeDate: "2026-11-12",
  treatingDoctor: null,
  confidence: 0.95,
};

export const receipt = { amountPaise: 4_200_000, merchantName: "Demo Hospital", paidAt: "2026-11-12T10:00:00Z", upiRef: "UPI1" };

export const ctx = (over: Partial<RuleContext> = {}): RuleContext => ({
  extracted: { bill, dischargeSummary, receipt },
  documents: [],
  policy: demoPolicy,
  admission: { emergency: true, admittedAt: "2026-11-10T08:00:00Z", notifiedAt: "2026-11-10T12:00:00Z" },
  today: "2026-11-13",
  ...over,
});
