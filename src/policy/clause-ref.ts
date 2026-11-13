// CIS clause refs: "II(1)(i)", "III(3)", "IV(2) (B) (C) & (D)", "Excl 03" (but not prose "Exclusion Code Excl 02").
export const REF_SRC = String.raw`\b(?:I{1,3}|IV|VI?)\s?\(\d+\)(?:\s*&?\s*\([A-Za-z0-9,]+\))*|\b(?<!Code\s)Excl\s+\d{2}\b`;

export const normRef = (s: string) => s.replace(/[\s&]+/g, "").replace(/^Excl/, "Excl ");

// "IV(2)(B)(C)(D)" falls back to "IV(2)(B)(C)"; "II(1)" falls back to a ref starting with it;
// "III(3) / Excl 03" tries each part.
export function pickChunk<T extends { clause_ref: string | null }>(rows: T[], ref: string): T | undefined {
  for (const part of ref.split(/[/,]/).map(normRef).filter(Boolean)) {
    for (let c = part; c.includes("("); c = c.replace(/\([^()]*\)$/, "")) {
      const hit = rows.find((r) => r.clause_ref === c);
      if (hit) return hit;
      if (!c.endsWith(")")) break;
    }
    const prefixed = rows.find((r) => r.clause_ref?.startsWith(part));
    if (prefixed) return prefixed;
  }
}
