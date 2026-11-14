import { z } from "zod";
import { sameOrigin } from "@/lib/provider/origin";

const bodySchema = z.object({ text: z.string().trim().min(1).max(900), language: z.enum(["en-IN", "hi-IN", "te-IN"]) }).strict();

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Please refresh the page and try again." }, { status: 403 });
  const key = process.env.SARVAM_API_KEY?.trim();
  if (!key) return Response.json({ error: "Voice playback is not configured yet." }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > 16000) return Response.json({ error: "The text is too long to read aloud." }, { status: 413 });
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return Response.json({ error: "Invalid voice request." }, { status: 400 }); }
  const checked = bodySchema.safeParse(raw);
  if (!checked.success) return Response.json({ error: "Please choose text in English, Telugu, or Hindi." }, { status: 400 });
  const { language } = checked.data;
  let { text } = checked.data;
  try {
    const nativeScript = language === "te-IN" ? /[\u0c00-\u0c7f]/u : /[\u0900-\u097f]/u;
    if (language !== "en-IN" && !nativeScript.test(text) && /[a-z]/iu.test(text)) {
      try {
        const converted = await fetch("https://api.sarvam.ai/transliterate", {
          method: "POST", headers: { "content-type": "application/json", "api-subscription-key": key },
          body: JSON.stringify({ input: text, source_language_code: "en-IN", target_language_code: language }),
          signal: AbortSignal.timeout(30000),
        });
        if (converted.ok) {
          const transliteration: unknown = await converted.json();
          if (typeof transliteration === "object" && transliteration !== null && "transliterated_text" in transliteration && typeof transliteration.transliterated_text === "string" && transliteration.transliterated_text.trim()) text = transliteration.transliterated_text;
        }
      } catch { /* Continue with the original text if transliteration is unavailable. */ }
    }
    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST", headers: { "content-type": "application/json", "api-subscription-key": key },
      body: JSON.stringify({ text, language_code: language, model: "bulbul:v3", speaker: language === "en-IN" ? "ishita" : "priya", output_audio_codec: "mp3" }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) return Response.json({ error: response.status === 429 ? "Voice service is busy. Please try again." : response.status === 401 || response.status === 403 ? "Voice service rejected the configured key or account access." : "Could not play this answer. Please try again." }, { status: 502 });
    const result: unknown = await response.json();
    const audio = typeof result === "object" && result !== null && "audios" in result && Array.isArray(result.audios) && typeof result.audios[0] === "string" ? result.audios[0] : "";
    if (!audio) return Response.json({ error: "Voice service returned no audio." }, { status: 502 });
    return new Response(new Uint8Array(Buffer.from(audio, "base64")), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Voice service did not respond. Please try again." }, { status: 502 });
  }
}
