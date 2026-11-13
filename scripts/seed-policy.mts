import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import { db } from "../src/lib/db";
import { embed } from "../src/lib/llm/embed";
import { REF_SRC } from "../src/policy/clause-ref";
import { chunkPages } from "../src/policy/ingest";
import { lookup } from "../src/policy/lookup";
import { demoPolicy as pol } from "../src/policy/profile";

const PDF = "seed/policy/star-fho-2026-cis.pdf";

const parser = new PDFParse({ data: await readFile(PDF) });
const { pages } = await parser.getText();
await parser.destroy();
const chunks = chunkPages(pages.map((p) => p.text));
console.log(`${pages.length} pages → ${chunks.length} clause refs`);
console.log(chunks.map((c) => `${c.clauseRef}@p${c.page}`).join("  "));

// one embedding per distinct text; refs sharing a row share its vector
const texts = [...new Set(chunks.map((c) => c.text))];
const vectors = new Map<string, number[]>();
// shortcut: no EMBED_MODEL → chunks stored without vectors; remove once the endpoint is in .env
if (process.env.EMBED_MODEL) {
  for (let i = 0; i < texts.length; i += 32) {
    const batch = texts.slice(i, i + 32);
    (await embed(batch)).forEach((v, j) => vectors.set(batch[j], v));
  }
  console.log(`embedded ${vectors.size} texts, dim ${vectors.values().next().value?.length}`);
} else console.warn("EMBED_MODEL not set: skipped embeddings");

const up = await db.from("policies").upsert({
  id: pol.id,
  insurer: pol.insurer,
  product: pol.product,
  wording_version: pol.wordingVersion,
  source_pdf: PDF,
});
if (up.error) throw up.error;
const del = await db.from("policy_chunks").delete().eq("policy_id", pol.id);
if (del.error) throw del.error;
const ins = await db.from("policy_chunks").insert(
  chunks.map((c) => ({ policy_id: pol.id, clause_ref: c.clauseRef, page: c.page, text: c.text, embedding: vectors.get(c.text) ?? null })),
);
if (ins.error) throw ins.error;

// every policy clause the rules cite must resolve
const cited = [
  pol.roomEntitlement.clauseRef,
  pol.waitingPeriods.initialDays.clauseRef,
  pol.waitingPeriods.specifiedDiseaseMonths.clauseRef,
  pol.waitingPeriods.preExistingMonths.clauseRef,
  pol.copay.clauseRef,
  pol.claimsProcedure.clauseRef,
  "II(1)",
].filter((r) => new RegExp(REF_SRC).test(r));
for (const ref of cited) {
  const hit = await lookup(ref);
  assert(hit, `no clause for ${ref}`);
  console.log(`lookup(${ref}) → ${hit.clauseRef} p${hit.page}: ${hit.text.replace(/\n/g, " ").slice(0, 90)}…`);
}
console.log("seed:policy ok");
