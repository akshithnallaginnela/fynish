import { describe, expect, it } from "vitest";
import billMissing from "../r-doc-bill-missing";
import receiptMissing from "../r-doc-receipt-missing";
import dischargeMissing from "../r-doc-discharge-missing";
import roomCategory from "../r-room-category";
import initialWait from "../r-initial-wait";
import specifiedDiseaseWait from "../r-specified-disease-wait";
import pedWait from "../r-ped-wait";
import copay61 from "../r-copay-61";
import notification from "../r-notification";
import submissionWindow from "../r-submission-window";
import dateMismatch from "../r-date-mismatch";
import sumInsuredExceeded from "../r-sum-insured-exceeded";
import docUnreadable from "../r-doc-unreadable";
import { bill, ctx, dischargeSummary, receipt } from "./fixture";

const ex = (over: object) => ctx({ extracted: { bill, dischargeSummary, receipt, ...over } });

describe("R-DOC-BILL-MISSING", () => {
  it("passes with bill", () => expect(billMissing.evaluate(ctx()).passed).toBe(true));
  it("fails without bill", () => expect(billMissing.evaluate(ex({ bill: undefined }))).toMatchObject({ passed: false, deduction: 30 }));
});

describe("R-DOC-RECEIPT-MISSING", () => {
  it("passes with receipt", () => expect(receiptMissing.evaluate(ctx()).passed).toBe(true));
  it("fails without receipt", () => expect(receiptMissing.evaluate(ex({ receipt: undefined }))).toMatchObject({ passed: false, deduction: 8 }));
});

describe("R-DOC-DISCHARGE-MISSING", () => {
  it("passes with summary", () => expect(dischargeMissing.evaluate(ctx()).passed).toBe(true));
  it("fails without summary", () => expect(dischargeMissing.evaluate(ex({ dischargeSummary: undefined }))).toMatchObject({ passed: false, deduction: 18 }));
});

describe("R-ROOM-CATEGORY", () => {
  it("fails for deluxe at ₹5L", () => {
    const r = roomCategory.evaluate(ctx());
    expect(r).toMatchObject({ passed: false, deduction: 10, clauseRefs: ["II(1)(i)"] });
    expect(r.reason).toContain("Single Standard A/C Room");
  });
  it("passes for single standard", () => expect(roomCategory.evaluate(ex({ bill: { ...bill, roomType: "Single A/C" } })).passed).toBe(true));
  it("unknown for unlisted room text", () => expect(roomCategory.evaluate(ex({ bill: { ...bill, roomType: "ICU" } })).passed).toBeNull());
});

describe("R-INITIAL-WAIT", () => {
  it("passes at 14 months", () => expect(initialWait.evaluate(ctx()).passed).toBe(true));
  it("fails at 10 days", () => {
    const r = initialWait.evaluate(ctx({ policy: { ...ctx().policy, continuousCoverSince: "2026-10-31" } }));
    expect(r).toMatchObject({ passed: false, deduction: 25 });
    expect(r.reason).toContain("10 days old");
  });
  it("accident exempt", () => {
    const c = ctx({ policy: { ...ctx().policy, continuousCoverSince: "2026-10-31" } });
    c.extracted = { ...c.extracted, dischargeSummary: { ...dischargeSummary, diagnosis: "Fracture after road accident" } };
    expect(initialWait.evaluate(c).passed).toBe(true);
  });
});

describe("R-SPECIFIED-DISEASE-WAIT", () => {
  it("passes for appendicitis", () => expect(specifiedDiseaseWait.evaluate(ctx()).passed).toBe(true));
  it("fails for hernia under 24 months", () => {
    const r = specifiedDiseaseWait.evaluate(ex({ dischargeSummary: { ...dischargeSummary, procedure: "Inguinal hernia repair" } }));
    expect(r).toMatchObject({ passed: false, deduction: 25 });
    expect(r.reason).toContain("Hernia has a 24-month waiting period");
  });
  it("passes for hernia after 24 months", () => {
    const c = ex({ dischargeSummary: { ...dischargeSummary, procedure: "Inguinal hernia repair" } });
    c.policy = { ...c.policy, continuousCoverSince: "2023-01-01" };
    expect(specifiedDiseaseWait.evaluate(c).passed).toBe(true);
  });
});

describe("R-PED-WAIT", () => {
  it("is informational, no deduction", () => expect(pedWait.evaluate(ctx())).toMatchObject({ passed: false, deduction: 0, severity: "info" }));
});

describe("R-COPAY-61", () => {
  it("passes at 34", () => expect(copay61.evaluate(ctx()).passed).toBe(true));
  it("flags at 61 with no deduction", () =>
    expect(copay61.evaluate(ctx({ policy: { ...ctx().policy, insuredAgeAtEntry: 61 } }))).toMatchObject({ passed: false, deduction: 0 }));
});

describe("R-NOTIFICATION", () => {
  it("passes when notified same day", () => expect(notification.evaluate(ctx()).passed).toBe(true));
  it("fails emergency notified after 24h", () => {
    const r = notification.evaluate(ctx({ admission: { emergency: true, admittedAt: "2026-11-10T08:00:00Z", notifiedAt: "2026-11-11T20:00:00Z" } }));
    expect(r).toMatchObject({ passed: false, deduction: 6 });
    expect(r.reason).toContain("36 hours");
  });
  it("fails planned notified under 48h before", () =>
    expect(notification.evaluate(ctx({ admission: { emergency: false, admittedAt: "2026-11-10T08:00:00Z", notifiedAt: "2026-11-09T08:00:00Z" } })).passed).toBe(false));
  it("unknown without admission info", () => expect(notification.evaluate(ctx({ admission: undefined })).passed).toBeNull());
});

describe("R-SUBMISSION-WINDOW", () => {
  it("passes at 1 day", () => expect(submissionWindow.evaluate(ctx()).passed).toBe(true));
  it("fails at 20 days", () => expect(submissionWindow.evaluate(ctx({ today: "2026-12-02" }))).toMatchObject({ passed: false, deduction: 8 }));
});

describe("R-DATE-MISMATCH", () => {
  it("passes when dates agree", () => expect(dateMismatch.evaluate(ctx()).passed).toBe(true));
  it("fails when discharge differs by 3 days", () =>
    expect(dateMismatch.evaluate(ex({ dischargeSummary: { ...dischargeSummary, dischargeDate: "2026-11-15" } }))).toMatchObject({ passed: false, deduction: 8 }));
  it("unknown without summary", () => expect(dateMismatch.evaluate(ex({ dischargeSummary: undefined })).passed).toBeNull());
});

describe("R-SUM-INSURED-EXCEEDED", () => {
  it("passes at ₹42,000", () => expect(sumInsuredExceeded.evaluate(ctx()).passed).toBe(true));
  it("fails above ₹5,00,000 with Indian grouping", () => {
    const r = sumInsuredExceeded.evaluate(ex({ bill: { ...bill, totalAmountPaise: 60_000_000 } }));
    expect(r).toMatchObject({ passed: false, deduction: 10 });
    expect(r.reason).toBe("The bill (₹6,00,000) is above your cover of ₹5,00,000.");
  });
});

describe("R-DOC-UNREADABLE", () => {
  it("passes with nothing to review", () => expect(docUnreadable.evaluate(ctx()).passed).toBe(true));
  it("fails and names the document", () => {
    const r = docUnreadable.evaluate(ex({ needsReview: ["discharge_summary"] }));
    expect(r).toMatchObject({ passed: false, deduction: 5, whatToDo: "Send a clearer photo of discharge summary." });
  });
});
