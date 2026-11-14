import { sameOrigin } from "@/lib/provider/origin";

const languages = new Set(["en-IN", "hi-IN", "te-IN"]);
const supported = new Set(["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/mpeg", "audio/x-wav"]);
const limit = 8 * 1024 * 1024;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Please refresh the page and try again." }, { status: 403 });
  const key = process.env.SARVAM_API_KEY?.trim();
  if (!key) return Response.json({ error: "Voice input is not configured yet. You can type your question." }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > limit + 65536) return Response.json({ error: "Recording is too large. Try a shorter message." }, { status: 413 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({ error: "The recording could not be read." }, { status: 400 }); }
  const file = form.get("file");
  const language = form.get("language");
  const script = form.get("script");
  if (!(file instanceof File) || !file.size || file.size > limit || !supported.has(file.type.split(";")[0]) || typeof language !== "string" || !languages.has(language) || (script !== "native" && script !== "roman")) {
    return Response.json({ error: "Please record a short message in English, Telugu, or Hindi." }, { status: 400 });
  }

  const payload = new FormData();
  payload.set("file", file, file.name);
  payload.set("language_code", language);
  payload.set("model", "saaras:v3");
  payload.set("mode", script === "roman" && language !== "en-IN" ? "translit" : "transcribe");
  try {
    const result = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST", headers: { "api-subscription-key": key }, body: payload,
      signal: AbortSignal.timeout(45000),
    });
    if (!result.ok) return Response.json({ error: result.status === 429 ? "Voice service is busy. Please try again." : result.status === 401 || result.status === 403 ? "Voice service rejected the configured key or account access." : "Could not transcribe the recording. Please try again or type your question." }, { status: 502 });
    const body: unknown = await result.json();
    const transcript = typeof body === "object" && body !== null && "transcript" in body && typeof body.transcript === "string" ? body.transcript.trim() : "";
    if (!transcript) return Response.json({ error: "I couldn't hear speech clearly. Please try again." }, { status: 422 });
    return Response.json({ transcript }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Voice service did not respond. Please try again or type your question." }, { status: 502 });
  }
}
