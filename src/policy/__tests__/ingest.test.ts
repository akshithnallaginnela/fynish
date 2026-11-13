import { describe, expect, it } from "vitest";
import { normRef, pickChunk } from "../clause-ref";
import { chunkPages } from "../ingest";

const HEADER = "STAR HEALTH | CIS\nFHO | UIN : X | CIS / FHO / V.6 / 2026\t{n} / 16";
const page = (n: number, body: string) => `${HEADER.replace("{n}", String(n))}\n${body}`;

const pages = [
  page(1, "In-patient Treatment: Admission beyond 24 hrs II(1)(i,ii,iii)\nDay Care Treatment: less than 24 hours II(2)"),
  page(2, "Initial waiting period\nwithin 30 days except accident\nIII(3) Excl\n03\nCongenital disease (except for\ncoverage II(19))"),
  page(3, "still congenital text\nIII(1) Excl\n01\nsubject to Exclusion Code Excl 02\nsubmission of documents\nIV(2) (B) (C)\n& (D)").replace(" / 16", " /16"),
];

describe("chunkPages", () => {
  const chunks = chunkPages(pages);
  const by = (ref: string) => chunks.find((c) => c.clauseRef === ref)!;

  it("finds every ref at a line end, in order", () =>
    expect(chunks.map((c) => c.clauseRef)).toEqual(["II(1)(i,ii,iii)", "II(2)", "III(3)", "Excl 03", "III(1)", "Excl 01", "IV(2)(B)(C)(D)"]));

  it("chunk text is the text before the ref, headers stripped", () => {
    expect(by("II(2)").text).toBe("Day Care Treatment: less than 24 hours");
    expect(by("III(3)").text).toBe("Initial waiting period\nwithin 30 days except accident");
    expect(chunks.some((c) => c.text.includes("STAR HEALTH"))).toBe(false);
  });

  it("refs on one line share text; mid-sentence refs don't split", () => {
    expect(by("Excl 03").text).toBe(by("III(3)").text);
    expect(by("III(1)").text).toContain("coverage II(19))");
    expect(by("IV(2)(B)(C)(D)").text).toContain("Exclusion Code Excl 02");
  });

  it("page is where the chunk starts", () => {
    expect(by("III(1)").page).toBe(2);
    expect(by("IV(2)(B)(C)(D)").page).toBe(3);
  });
});

describe("pickChunk", () => {
  const rows = ["II(1)(i,ii,iii)", "II(1)(i)", "III(3)", "Excl 03", "IV(2)(B)(C)"].map((clause_ref) => ({ clause_ref }));
  it("exact", () => expect(pickChunk(rows, "II(1)(i)")?.clause_ref).toBe("II(1)(i)"));
  it("drops trailing groups", () => expect(pickChunk(rows, "IV(2)(B)(C)(D)")?.clause_ref).toBe("IV(2)(B)(C)"));
  it("prefix for a parent ref", () => expect(pickChunk(rows, "II(1)")?.clause_ref).toBe("II(1)(i,ii,iii)"));
  it("first part of a compound ref", () => expect(pickChunk(rows, "III(3) / Excl 03")?.clause_ref).toBe("III(3)"));
  it("miss", () => expect(pickChunk(rows, "IV(9)")).toBeUndefined());
  it("normRef", () => expect(normRef(" IV (2) (B) & (D)")).toBe("IV(2)(B)(D)"));
});
