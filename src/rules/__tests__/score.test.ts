import { describe, expect, it } from "vitest";
import { evaluateAll, rules } from "..";
import { bill, ctx, dischargeSummary, receipt } from "./fixture";

const failed = (r: ReturnType<typeof evaluateAll>) => r.breakdown.filter((x) => x.passed === false && x.deduction > 0).map((x) => x.ruleId);

describe("evaluateAll (demo fixture)", () => {
  it("receipt + bill → 72, not ready", () => {
    const r = evaluateAll(ctx({ extracted: { bill, receipt } }));
    expect(r.score).toBe(72);
    expect(r.readyToSubmit).toBe(false);
    expect(failed(r)).toEqual(["R-DOC-DISCHARGE-MISSING", "R-ROOM-CATEGORY"]);
  });

  it("receipt + bill + discharge → 90, ready", () => {
    const r = evaluateAll(ctx());
    expect(r.score).toBe(90);
    expect(r.readyToSubmit).toBe(true);
    expect(failed(r)).toEqual(["R-ROOM-CATEGORY"]);
  });

  it("hernia → 65, blocker", () => {
    const r = evaluateAll(ctx({ extracted: { bill, receipt, dischargeSummary: { ...dischargeSummary, procedure: "Inguinal hernia repair" } } }));
    expect(r.score).toBe(65);
    expect(r.readyToSubmit).toBe(false);
  });

  it("blocker blocks even at ≥80", () => {
    const r = evaluateAll(ctx({ extracted: { bill, receipt, dischargeSummary }, policy: { ...ctx().policy, continuousCoverSince: "2026-11-01" } }), [rules[4]]);
    expect(r.score).toBe(75);
    expect(r.readyToSubmit).toBe(false);
  });

  it("score is order independent and breakdown sorted by deduction", () => {
    const shuffled = [...rules].sort(() => Math.random() - 0.5);
    const a = evaluateAll(ctx({ extracted: { bill, receipt } }));
    const b = evaluateAll(ctx({ extracted: { bill, receipt } }), shuffled);
    expect(b.score).toBe(a.score);
    expect(b.breakdown.map((x) => x.deduction)).toEqual([...b.breakdown.map((x) => x.deduction)].sort((x, y) => y - x));
  });

  it("clamps at 0", () => {
    const r = evaluateAll(ctx({ extracted: {}, today: "2027-06-01", policy: { ...ctx().policy, insuredAgeAtEntry: 70 } }));
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.breakdown).toHaveLength(rules.length);
  });
});
