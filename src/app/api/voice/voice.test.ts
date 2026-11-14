import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as transcribe } from "./transcribe/route";
import { POST as speak } from "./speak/route";

const origin = "http://127.0.0.1:3000";

beforeEach(() => {
  vi.stubEnv("FYNISH_BASE_URL", origin);
  vi.stubEnv("SARVAM_API_KEY", "test-key");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Sarvam voice routes", () => {
  it("forwards selected language and Roman transcription mode without exposing the key", async () => {
    const provider = vi.fn<(url: string, options: RequestInit) => Promise<Response>>().mockResolvedValue(Response.json({ transcript: "Mujhe madad chahiye" }));
    vi.stubGlobal("fetch", provider);
    const form = new FormData();
    form.set("file", new File(["audio"], "voice.webm", { type: "audio/webm" }));
    form.set("language", "hi-IN"); form.set("script", "roman");
    const response = await transcribe(new Request(`${origin}/api/voice/transcribe`, { method: "POST", headers: { origin }, body: form }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ transcript: "Mujhe madad chahiye" });
    const options = provider.mock.calls[0][1] as RequestInit;
    expect((options.body as FormData).get("language_code")).toBe("hi-IN");
    expect((options.body as FormData).get("mode")).toBe("translit");
  });

  it("transliterates Roman Telugu for speech while returning only audio", async () => {
    const provider = vi.fn()
      .mockResolvedValueOnce(Response.json({ transliterated_text: "నాకు సహాయం చేయండి" }))
      .mockResolvedValueOnce(Response.json({ audios: [Buffer.from("audio").toString("base64")] }));
    vi.stubGlobal("fetch", provider);
    const response = await speak(new Request(`${origin}/api/voice/speak`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ text: "Naaku sahayam cheyyandi", language: "te-IN" }) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(await response.text()).toBe("audio");
    expect(JSON.parse(provider.mock.calls[1][1].body as string)).toMatchObject({ text: "నాకు సహాయం చేయండి", language_code: "te-IN", model: "bulbul:v3" });
  });

  it("rejects another origin and reports a missing key", async () => {
    const provider = vi.fn();
    vi.stubGlobal("fetch", provider);
    const payload = JSON.stringify({ text: "Hello", language: "en-IN" });
    const blocked = await speak(new Request(`${origin}/api/voice/speak`, { method: "POST", headers: { origin: "https://example.com", "content-type": "application/json" }, body: payload }));
    expect(blocked.status).toBe(403);
    vi.stubEnv("SARVAM_API_KEY", "");
    const missing = await speak(new Request(`${origin}/api/voice/speak`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: payload }));
    expect(missing.status).toBe(503);
    expect(provider).not.toHaveBeenCalled();
  });
});
