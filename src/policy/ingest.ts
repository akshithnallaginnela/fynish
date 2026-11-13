import { normRef, REF_SRC } from "./clause-ref";

export type Chunk = { clauseRef: string; page: number; text: string };

// A CIS row ends with its clause ref(s) in the right-hand column, so a line ending in refs closes a chunk.
const TAIL = new RegExp(String.raw`(?:\s*(?:${REF_SRC}))+\s*$`);
const REF = new RegExp(REF_SRC, "g");

export function chunkPages(pages: string[]): Chunk[] {
  const joined = pages.map((p) =>
    p
      .replace(/Excl\s*\n\s*(\d{2})/g, "Excl $1") // "III(3) Excl\n03"
      .replace(/\n\s*(&\s*\([A-Z]\))/g, " $1"), // "IV(2) (B) (C)\n& (D)"
  );

  // running headers: top-of-page lines (digits and spaces masked) that repeat on more than half the pages
  const TOP = 3;
  const key = (l: string) => l.replace(/\s+/g, "").replace(/\d+/g, "#");
  const seen = new Map<string, number>();
  for (const p of joined) for (const k of new Set(p.split("\n").slice(0, TOP).map(key))) seen.set(k, (seen.get(k) ?? 0) + 1);
  const isHeader = (l: string, idx: number) => idx < TOP && seen.get(key(l))! > pages.length / 2;
  const lines = joined.flatMap((p, i) =>
    p
      .split("\n")
      .filter((l, idx) => l.trim() && !isHeader(l, idx))
      .map((l) => ({ page: i + 1, text: l.replace(/\s+/g, " ").trim() })),
  );

  const chunks: Chunk[] = [];
  let buf: typeof lines = [];
  for (const l of lines) {
    const tail = l.text.match(TAIL);
    if (!tail) {
      buf.push(l);
      continue;
    }
    const head = l.text.slice(0, tail.index).trim();
    if (head) buf.push({ ...l, text: head });
    // refs straight after refs share the previous chunk's text
    const text = buf.map((b) => b.text).join("\n") || chunks.at(-1)?.text || "";
    const page = buf[0]?.page ?? l.page;
    for (const r of tail[0].match(REF)!) chunks.push({ clauseRef: normRef(r), page, text });
    buf = [];
  }
  return chunks;
}
