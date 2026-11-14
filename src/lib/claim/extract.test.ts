import { afterEach, describe, expect, it, vi } from "vitest";
import { extractDocument } from "./extract";

vi.mock("pdf-parse", () => ({
  PDFParse: class {
    getText(): never { throw new Error("Gemini PDFs should not use the local parser"); }
    destroy() { return Promise.resolve(); }
  },
}));

const bill = {
  hospitalName: "Demo Hospital", patientName: "Demo Patient",
  admissionDate: "2026-11-10", dischargeDate: "2026-11-12",
  roomType: null, roomRentPerDayPaise: null, totalAmountPaise: 4200000,
  lineItems: [{ label: "Surgery", amountPaise: 4200000 }], confidence: 0.95,
};

describe("document extraction", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("sends a PDF directly to Gemini for visual reading", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "");
    vi.stubEnv("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai");
    vi.stubEnv("LLM_MODEL", "demo-model");
    vi.stubEnv("LLM_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(bill) }] } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await extractDocument(new File(["%PDF-1.4\nscan"], "scan.pdf"), "bill");
    expect(result.data.totalAmountPaise).toBe(4200000);
    expect(fetchMock.mock.calls[0][0]).toBe("https://generativelanguage.googleapis.com/v1beta/models/demo-model:generateContent");
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.contents[0].parts[1].inlineData.mimeType).toBe("application/pdf");
  });

  it("does not accept a document that cannot be identified as a payment receipt", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "");
    vi.stubEnv("LLM_BASE_URL", "https://example.test/v1");
    vi.stubEnv("LLM_MODEL", "demo-model");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify({ amountPaise: 0, merchantName: "", paidAt: "", upiRef: "" }) } }] })));
    const image = new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "bill.jpg");
    await expect(extractDocument(image, "receipt")).rejects.toThrow("fields could not be verified");
  });
});
