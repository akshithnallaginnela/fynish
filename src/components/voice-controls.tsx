"use client";

import { useEffect, useRef, useState } from "react";

export type VoiceLanguage = "en-IN" | "te-IN" | "hi-IN";
export type VoiceScript = "native" | "roman";

export function useSarvamVoice({ language, script = "native", onTranscript }: { language: VoiceLanguage; script?: VoiceScript; onTranscript: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      abort.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopRecording = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const toggleRecording = async () => {
    if (recorder.current?.state === "recording") { stopRecording(); return; }
    if (pending.current || transcribing) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is unavailable in this browser. You can type your question.");
      return;
    }
    pending.current = true;
    setError("");
    let activeStream: MediaStream | null = null;
    try {
      activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { activeStream.getTracks().forEach((track) => track.stop()); return; }
      stream.current = activeStream;
      const chosen = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      const instance = chosen ? new MediaRecorder(activeStream, { mimeType: chosen }) : new MediaRecorder(activeStream);
      const chunks: BlobPart[] = [];
      instance.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      instance.onerror = () => { if (mounted.current) setError("Recording stopped unexpectedly. Please try again."); };
      instance.onstop = () => {
        activeStream?.getTracks().forEach((track) => track.stop());
        if (stream.current === activeStream) stream.current = null;
        recorder.current = null;
        if (!mounted.current) return;
        setRecording(false);
        if (!chunks.length) { setError("No audio was recorded. Please try again."); return; }
        const mime = (instance.mimeType || "audio/webm").split(";")[0];
        const extension = mime === "audio/mp4" ? "m4a" : mime === "audio/ogg" ? "ogg" : "webm";
        const audio = new File(chunks, `recording.${extension}`, { type: mime });
        const form = new FormData();
        form.set("file", audio); form.set("language", language); form.set("script", script);
        const controller = new AbortController();
        abort.current = controller;
        setTranscribing(true);
        void fetch("/api/voice/transcribe", { method: "POST", body: form, signal: controller.signal }).then(async (response) => {
          const result = await response.json().catch(() => ({}));
          if (!response.ok || typeof result.transcript !== "string") throw new Error(result.error || "Could not transcribe the recording.");
          if (mounted.current) onTranscript(result.transcript);
        }).catch((cause: unknown) => {
          if (mounted.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not transcribe the recording.");
        }).finally(() => { if (abort.current === controller) abort.current = null; if (mounted.current) setTranscribing(false); });
      };
      recorder.current = instance;
      instance.start();
      setRecording(true);
      timer.current = setTimeout(stopRecording, 28000);
    } catch (cause) {
      activeStream?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      recorder.current = null;
      if (mounted.current) setError(cause instanceof DOMException && (cause.name === "NotAllowedError" || cause.name === "SecurityError") ? "Microphone access is blocked. Allow it in your browser and try again." : "Could not start the microphone. Check your microphone and try again.");
    } finally { pending.current = false; }
  };

  return { recording, transcribing, error, setError, toggleRecording, stopRecording };
}

function speechChunks(text: string) {
  const clean = text.replace(/https?:\/\/\S+/gu, "").replace(/[*#`]/gu, "").trim();
  const words = clean.split(/\s+/u).filter(Boolean);
  const result: string[] = [];
  let current = "";
  for (let word of words) {
    while (word.length > 800) { if (current) { result.push(current); current = ""; } result.push(word.slice(0, 800)); word = word.slice(800); }
    if ((current + " " + word).trim().length > 800) { result.push(current); current = word; }
    else current = current ? `${current} ${word}` : word;
  }
  if (current) result.push(current);
  return result;
}

let stopActive: (() => void) | null = null;

export function VoicePlayback({ text, language }: { text: string; language: VoiceLanguage }) {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const current = useRef<AbortController | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const mounted = useRef(true);

  const stop = () => { current.current?.abort(); player.current?.pause(); if (mounted.current) setSpeaking(false); };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; current.current?.abort(); player.current?.pause(); }; }, []);

  const toggle = async () => {
    if (current.current && !current.current.signal.aborted) { stop(); return; }
    stopActive?.();
    const controller = new AbortController();
    current.current = controller;
    stopActive = stop;
    setSpeaking(true); setError("");
    try {
      for (const part of speechChunks(text)) {
        if (controller.signal.aborted) break;
        const response = await fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: part, language }), signal: controller.signal });
        if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || "Could not play this answer."); }
        const url = URL.createObjectURL(await response.blob());
        try {
          if (controller.signal.aborted) break;
          const audio = new Audio(url);
          player.current = audio;
          await new Promise<void>((resolve, reject) => {
            const onAbort = () => { audio.pause(); resolve(); };
            controller.signal.addEventListener("abort", onAbort, { once: true });
            audio.onended = () => { controller.signal.removeEventListener("abort", onAbort); resolve(); };
            audio.onerror = () => { controller.signal.removeEventListener("abort", onAbort); reject(new Error("Could not play this answer.")); };
            void audio.play().catch((cause: unknown) => { controller.signal.removeEventListener("abort", onAbort); reject(cause); });
          });
        } finally { player.current = null; URL.revokeObjectURL(url); }
      }
    } catch (cause) {
      if (!controller.signal.aborted && mounted.current) setError(cause instanceof Error ? cause.message : "Could not play this answer.");
    } finally {
      if (current.current === controller) current.current = null;
      if (stopActive === stop) stopActive = null;
      if (mounted.current) setSpeaking(false);
    }
  };

  return <div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" onClick={() => void toggle()} aria-label={speaking ? "Stop reading this answer" : "Listen to this answer"} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-2 hover:bg-cream">{speaking ? "■ Stop" : "🔊 Listen"}</button>{error && <span role="status" className="text-xs text-amber-ink">{error}</span>}</div>;
}
