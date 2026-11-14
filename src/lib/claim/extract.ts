import { PDFParse } from "pdf-parse";
import { DischargeSummary, HospitalBill } from "@/lib/types";
import { z } from "zod";

export class ExtractionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const MAX_BYTES = 10 * 1024 * 1024;
type SupportedMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;

function mimeOf(bytes: Uint8Array): SupportedMime | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  return null;
}

const prompts = {
  bill: `Read this itemised hospital bill. Return only a JSON object with keys hospitalName, patientName, admissionDate, dischargeDate, roomType, roomRentPerDayPaise, totalAmountPaise, lineItems, confidence. Dates must be YYYY-MM-DD, or an empty string if unreadable. Money must be integer paise, never rupees. lineItems is an array of {label, amountPaise}; include every visible charge, without inventing any. roomType and roomRentPerDayPaise may be null. confidence is 0 to 1; use a low value when fields are unclear. Do not add commentary.`,
  discharge: `Read this hospital discharge summary. Return only a JSON object with keys diagnosis, procedure, admissionDate, dischargeDate, treatingDoctor, confidence. Dates must be YYYY-MM-DD, or an empty string if unreadable. procedure and treatingDoctor may be null. confidence is 0 to 1; use a low value when fields are unclear. Do not add commentary.`,
  receipt: `Read this hospital payment receipt. Return only a JSON object with keys amountPaise, merchantName, paidAt, upiRef. Amount must be integer paise, not rupees. Use empty strings for missing text. Do not invent details. Do not treat a hospital bill as a payment receipt unless it shows a payment was received. If it is not a receipt or the amount is unclear, return amountPaise as 0.`,
};

const PaymentReceipt = z.object({ amountPaise: z.number().int().positive(), merchantName: z.string().min(1), paidAt: z.string(), upiRef: z.string() });
type PaymentReceipt = z.infer<typeof PaymentReceipt>;

export function extractDocument(file: File, kind: "bill"): Promise<{ kind: "bill"; data: HospitalBill; mime: SupportedMime; bytes: Uint8Array }>;
export function extractDocument(file: File, kind: "discharge"): Promise<{ kind: "discharge"; data: DischargeSummary; mime: SupportedMime; bytes: Uint8Array }>;
export function extractDocument(file: File, kind: "receipt"): Promise<{ kind: "receipt"; data: PaymentReceipt; mime: SupportedMime; bytes: Uint8Array }>;
export async function extractDocument(file: File, kind: "bill" | "discharge" | "receipt"): Promise<
  { kind: "bill"; data: HospitalBill; mime: SupportedMime; bytes: Uint8Array } |
  { kind: "discharge"; data: DischargeSummary; mime: SupportedMime; bytes: Uint8Array } |
  { kind: "receipt"; data: PaymentReceipt; mime: SupportedMime; bytes: Uint8Array }
> {
  if (!file.size || file.size > MAX_BYTES) throw new ExtractionError(413, "Upload a non-empty document under 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = mimeOf(bytes);
  if (!mime) throw new ExtractionError(415, "Upload a JPEG, PNG, WebP, or PDF.");

  const base = process.env.OLLAMA_BASE_URL
    ? `${process.env.OLLAMA_BASE_URL.replace(/\/$/, "")}/v1`
    : process.env.LLM_BASE_URL?.replace(/\/$/, "");
  const model = process.env.LLM_MODEL;
  if (!base || !model) throw new ExtractionError(503, "Document extraction is not configured. Set LLM_BASE_URL and LLM_MODEL.");
  const isGemini = base.startsWith("https://generativelanguage.googleapis.com/v1beta/openai");

  let content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = "";
  const nativePdf = mime === "application/pdf" && isGemini;
  // Gemini reads both text and scanned PDFs directly, including page layout.
  if (mime === "application/pdf" && !nativePdf) {
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      const pdfText = result.pages.map((p) => p.text).join("\n").slice(0, 30_000).trim();
      if (pdfText.length < 50) {
        throw new ExtractionError(422, "This scanned PDF needs a Gemini connection. Upload a clear photo instead.");
      } else content = `${prompts[kind]}\n\nDocument text:\n${pdfText}`;
    } catch (error) {
      if (error instanceof ExtractionError) throw error;
      throw new ExtractionError(422, "This PDF could not be opened. Upload an unprotected, clear copy.");
    } finally {
      await parser.destroy();
    }
  } else if (!nativePdf) {
    content = [
      { type: "text", text: prompts[kind] },
      { type: "image_url", image_url: { url: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}` } },
    ];
  }

  let response: Response;
  try {
    response = await fetch(nativePdf ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` : `${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.LLM_API_KEY ? (nativePdf ? { "x-goog-api-key": process.env.LLM_API_KEY } : { authorization: `Bearer ${process.env.LLM_API_KEY}` }) : {}),
      },
      body: JSON.stringify(nativePdf
        ? { contents: [{ parts: [{ text: prompts[kind] }, { inlineData: { mimeType: "application/pdf", data: Buffer.from(bytes).toString("base64") } }] }] }
        : { model, ...(isGemini ? { reasoning_effort: "low" } : { temperature: 0 }), messages: [{ role: "user", content }] }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new ExtractionError(502, "Document extraction service did not respond.");
  }
  if (!response.ok) throw new ExtractionError(502, `Document extraction service returned ${response.status}.`);

  let raw: unknown;
  try {
    const result = await response.json();
    const message = nativePdf ? result?.candidates?.[0]?.content?.parts : result?.choices?.[0]?.message?.content;
    raw = typeof message === "string" ? message : Array.isArray(message) ? message.map((part: { text?: string }) => part.text ?? "").join("") : "";
  } catch {
    throw new ExtractionError(502, "Document extraction returned an invalid response.");
  }
  const jsonText = typeof raw === "string" ? raw.match(/\{[\s\S]*\}/)?.[0] : undefined;
  if (!jsonText) throw new ExtractionError(422, "The document could not be read. Upload a clearer copy.");
  let value: unknown;
  try { value = JSON.parse(jsonText); } catch { throw new ExtractionError(422, "The document could not be read. Upload a clearer copy."); }
  const schema = kind === "bill" ? HospitalBill : kind === "discharge" ? DischargeSummary : PaymentReceipt;
  const checked = schema.safeParse(value);
  if (!checked.success) throw new ExtractionError(422, "The document fields could not be verified. Upload a clearer copy.");
  if (kind === "bill") {
    const bill = HospitalBill.parse(checked.data);
    if (!validDate(bill.admissionDate) || !validDate(bill.dischargeDate)) {
      throw new ExtractionError(422, "The bill dates could not be verified. Upload a clearer copy.");
    }
    if (bill.totalAmountPaise <= 0 || bill.lineItems.some((item) => item.amountPaise < 0) || (bill.roomRentPerDayPaise !== null && bill.roomRentPerDayPaise < 0)) {
      throw new ExtractionError(422, "The bill amounts could not be verified.");
    }
    return { kind: "bill", data: bill, mime, bytes };
  }
  if (kind === "receipt") return { kind: "receipt", data: PaymentReceipt.parse(checked.data), mime, bytes };
  const discharge = DischargeSummary.parse(checked.data);
  if (!validDate(discharge.admissionDate) || !validDate(discharge.dischargeDate)) {
    throw new ExtractionError(422, "The discharge dates could not be verified. Upload a clearer copy.");
  }
  return { kind: "discharge", data: discharge, mime, bytes };
}
