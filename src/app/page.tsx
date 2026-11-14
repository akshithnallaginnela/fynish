"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Mark from "@/components/mark";
import Wordmark from "@/components/wordmark";
import ClaimFlow from "@/components/claim-flow";
import TransactionHistory from "@/components/transaction-history";
import CursorBackground from "@/components/cursor-background";
import { useSarvamVoice, VoicePlayback, type VoiceLanguage, type VoiceScript } from "@/components/voice-controls";
import { ONBOARDING_KEY } from "@/lib/onboarding";

type Message = { id: string; role: "user" | "assistant"; text: string; voiceLanguage?: VoiceLanguage; attachment?: { name: string }; failed?: boolean };
type PaymentSignal = { orderId: string; hospitalName: string; amountPaise: number; paymentId: string | null; method: string | null; paidAt: string | null; seen: boolean; isHospital: boolean };
type Conversation = { id: string; title: string; messages: Message[]; paymentOrderId?: string; journeyId?: string };
const CHAT_HISTORY_KEY = "fynish.chats";

const SUGGESTIONS = ["What does health insurance usually cover?", "How does a reimbursement claim work?", "What should I check before buying a policy?"];
const subscribeToProfile = (callback: () => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};
const readChatHistory = () => {
  try { return localStorage.getItem(CHAT_HISTORY_KEY) ?? "[]"; }
  catch { return "[]"; }
};
function parseChatHistory(value: string): Conversation[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is Conversation => item && typeof item.id === "string" && typeof item.title === "string" && Array.isArray(item.messages)) : [];
  } catch { return []; }
}
function languageOf(text: string) {
  if (/[\u0C00-\u0C7F]/u.test(text)) return "te";
  if (/[\u0900-\u097F]/u.test(text)) return "hi";
  const lower = ` ${text.toLowerCase()} `;
  if (/\b(naaku|naku|mee|ela|undi|chesukovali|cheyyali|cheyali|cheysina|cheysthe|cheysthundi|avuthundi|kavala|ante|nenu|cheppu|nuvvu|nuvv|enti|enduku|ardham|osthundi|osthadi|asalu)\b/u.test(lower)) return "te";
  if (/\b(mujhe|mera|meri|kaise|kya|hai|hain|chahiye|karna|ka|ki|ke|policy batao|claim kaise)\b/u.test(lower)) return "hi";
  return "en";
}

function voiceLanguageFor(messages: Message[], index: number): VoiceLanguage {
  const answerLanguage = languageOf(messages[index]?.text ?? "");
  const question = messages.slice(0, index).reverse().find((message) => message.role === "user");
  if (answerLanguage === "en" && question?.voiceLanguage) return question.voiceLanguage;
  const language = answerLanguage === "en" ? languageOf(question?.text ?? "") : answerLanguage;
  return language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-IN";
}

function thinkingLabel(text: string) {
  const language = languageOf(text);
  if (language === "te") return /[\u0C00-\u0C7F]/u.test(text) ? "ఆలోచిస్తున్నాను…" : "Aalochisthunna…";
  if (language === "hi") return /[\u0900-\u097F]/u.test(text) ? "सोच रहा हूँ…" : "Soch raha hoon…";
  return "Thinking…";
}

function failureText(text: string) {
  const language = languageOf(text);
  if (language === "te") return /[\u0C00-\u0C7F]/u.test(text) ? "ఇప్పుడు సమాధానం ఇవ్వలేకపోయాను. మళ్లీ ప్రయత్నించండి." : "Ippudu samadhanam ivvalekapoyanu. Malli try cheyyandi.";
  if (language === "hi") return /[\u0900-\u097F]/u.test(text) ? "अभी जवाब नहीं दे पाया। कृपया फिर कोशिश करें।" : "Abhi jawab nahi de paya. Phir koshish karein.";
  return "I couldn't answer just now. Please try again.";
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function MessageText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/gu);
  return <>{parts.map((part, index) => /^https?:\/\//u.test(part)
    ? <a key={index} href={part} target="_blank" rel="noreferrer" className="text-blue underline underline-offset-2">Source</a>
    : part)}</>;
}

export default function Home() {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploadMenu, setUploadMenu] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentChatId, setCurrentChatId] = useState("");
  const [activePaymentOrderId, setActivePaymentOrderId] = useState("");
  const [activeJourneyId, setActiveJourneyId] = useState("");
  const [inlineView, setInlineView] = useState<"provider" | "transactions" | null>(null);
  const chatSnapshot = useRef({ id: "", messages: [] as Message[], paymentOrderId: "", journeyId: "" });
  const [historyOverride, setHistoryOverride] = useState<Conversation[] | null>(null);
  const savedHistory = useSyncExternalStore(subscribeToProfile, readChatHistory, () => "[]");
  const conversations = historyOverride ?? parseChatHistory(savedHistory);
  const [paymentSignals, setPaymentSignals] = useState<PaymentSignal[]>([]);
  const [busy, setBusy] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>("en-IN");
  const [voiceScript, setVoiceScript] = useState<VoiceScript>("native");
  useEffect(() => { chatSnapshot.current = { id: currentChatId, messages, paymentOrderId: activePaymentOrderId, journeyId: activeJourneyId }; }, [currentChatId, messages, activePaymentOrderId, activeJourneyId]);
  const inputVoiceLanguage = useRef<VoiceLanguage | null>(null);
  const { recording: listening, transcribing, error: voiceError, setError: setVoiceError, toggleRecording: toggleVoice } = useSarvamVoice({
    language: voiceLanguage,
    script: voiceScript,
    onTranscript: (transcript) => { inputVoiceLanguage.current = voiceLanguage; setDraft((current) => [current.trim(), transcript].filter(Boolean).join(" ")); },
  });
  const customerName = useSyncExternalStore(
    subscribeToProfile,
    () => {
      try { return (JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? "null") as { name?: string } | null)?.name ?? ""; }
      catch { return ""; }
    },
    () => "",
  );
  const paymentConnected = useSyncExternalStore(
    subscribeToProfile,
    () => {
      try { return (JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? "null") as { bankConnected?: string } | null)?.bankConnected === "true"; }
      catch { return false; }
    },
    () => false,
  );
  const messagesEnd = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const saveConversation = (conversation: Conversation) => {
    const updated = [conversation, ...parseChatHistory(readChatHistory()).filter((item) => item.id !== conversation.id)].slice(0, 30);
    setHistoryOverride(updated);
    try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updated)); } catch { /* Keep this session usable. */ }
  };

  const newConversation = () => {
    if (busy) return;
    setCurrentChatId("");
    setActivePaymentOrderId("");
    setActiveJourneyId("");
    setInlineView(null);
    setMessages([]);
    setAttachment(null);
    setUploadMenu(false);
    setDraft("");
    if (menu) closeMenu();
  };

  const closeMenu = () => {
    setMenu(false);
    requestAnimationFrame(() => menuButton.current?.focus());
  };

  const openInline = (view: "provider" | "transactions") => {
    if (busy) return;
    setInlineView(view);
    if (!messages.length) {
      const chatId = currentChatId || createId();
      const text = view === "provider" ? "Let's look at your insurance connection." : "Here are your transaction alerts.";
      const intro: Message = { id: createId(), role: "assistant", text };
      setCurrentChatId(chatId);
      setMessages([intro]);
      saveConversation({ id: chatId, title: view === "provider" ? "Insurance provider" : "Transaction history", messages: [intro] });
    }
    if (menu) closeMenu();
  };

  const onboarded = useSyncExternalStore(
    () => () => {},
    () => {
      try { return localStorage.getItem(ONBOARDING_KEY) !== null || new URLSearchParams(window.location.search).has("preview"); }
      catch { return true; }
    },
    () => null,
  );

  useEffect(() => {
    if (onboarded === false) router.replace("/welcome");
  }, [onboarded, router]);

  useEffect(() => {
    if (onboarded !== true || !paymentConnected) return;
    let active = true;
    const refresh = () => {
      fetch("/api/payment-feed", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((body) => {
        if (active && Array.isArray(body?.signals)) setPaymentSignals(body.signals as PaymentSignal[]);
      }).catch(() => {});
    };
    refresh();
    const interval = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [onboarded, paymentConnected]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    const latest = [...messages].reverse().find((message) => message.role === "user")?.text ?? draft;
    const language = languageOf(latest);
    document.documentElement.lang = language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en";
  }, [messages, draft]);

  useEffect(() => {
    if (!menu) return;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeMenu(); };
    const desktop = window.matchMedia("(min-width: 768px)");
    const onResize = () => { if (desktop.matches) setMenu(false); };
    window.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onResize);
    return () => { window.removeEventListener("keydown", onKey); desktop.removeEventListener("change", onResize); };
  }, [menu]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy || listening || transcribing) return;
    const userMessage: Message = { id: createId(), role: "user", text, ...(inputVoiceLanguage.current ? { voiceLanguage: inputVoiceLanguage.current } : {}), ...(attachment ? { attachment: { name: attachment.name } } : {}) };
    inputVoiceLanguage.current = null;
    const assistantMessage: Message = { id: createId(), role: "assistant", text: "" };
    const chatId = currentChatId || createId();
    if (!currentChatId) setCurrentChatId(chatId);
    const firstUser = [...messages, userMessage].find((message) => message.role === "user")!;
    const detectedLanguage = languageOf(firstUser.text);
    const language = detectedLanguage === "en" && firstUser.voiceLanguage ? firstUser.voiceLanguage.slice(0, 2) : detectedLanguage;
    const script = language === "te" ? (/[\u0C00-\u0C7F]/u.test(firstUser.text) ? "native" : "roman") : language === "hi" ? (/[\u0900-\u097F]/u.test(firstUser.text) ? "native" : "roman") : "native";
    const history = [...messages.filter((message) => !message.failed && message.text.trim()), userMessage].slice(-12).map(({ role, text: content }) => ({ role, content: content.slice(0, 2000) }));
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setDraft("");
    setVoiceError("");
    setInlineView(null);
    setUploadMenu(false);
    setBusy(true);
    let answer = "";
    let failed = false;
    let journeyId = activeJourneyId;
    let uploadError = "";
    try {
      if (attachment) {
        const form = new FormData();
        form.set("bill", attachment);
        if (activePaymentOrderId) form.set("paymentOrderId", activePaymentOrderId);
        const result = await fetch("/api/claim/analyze", { method: "POST", body: form });
        if (!result.ok) {
          uploadError = result.status === 409
            ? (language === "te" ? (script === "native" ? "ముందుగా మీ ఇన్సూరెన్స్ పాలసీని కనెక్ట్ చేసి ఎంచుకోండి." : "Munduga mee insurance policy ni connect chesi select cheyyandi.") : language === "hi" ? (script === "native" ? "पहले अपनी बीमा पॉलिसी कनेक्ट करके चुनें।" : "Pehle apni insurance policy connect karke select karein.") : "Please connect and select your insurance policy first.")
            : result.status === 413
              ? (language === "te" ? (script === "native" ? "10 MB కంటే చిన్న ఫైల్‌ను ఎంచుకోండి." : "10 MB kante chinna file ni select cheyyandi.") : language === "hi" ? (script === "native" ? "10 MB से छोटी फ़ाइल चुनें।" : "10 MB se chhoti file select karein.") : "Please choose a file smaller than 10 MB.")
            : result.status < 500
              ? (language === "te" ? (script === "native" ? "బిల్ చదవలేకపోయాను. స్పష్టమైన చిత్రం లేదా PDFతో మళ్లీ ప్రయత్నించండి." : "Bill chadavalekapoyanu. Clear image leda PDF tho malli try cheyyandi.") : language === "hi" ? (script === "native" ? "बिल पढ़ नहीं पाया। साफ़ तस्वीर या PDF के साथ फिर कोशिश करें।" : "Bill padh nahi paya. Clear image ya PDF ke saath phir koshish karein.") : "I couldn't read the bill. Please try again with a clear image or PDF.")
              : failureText(firstUser.text);
          throw new Error("bill upload failed");
        }
        const analysis: { journeyId?: string } = await result.json();
        if (!analysis.journeyId) throw new Error("bill analysis unavailable");
        journeyId = analysis.journeyId;
        setActiveJourneyId(journeyId);
        setAttachment(null);
      }
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history, language, script, ...(journeyId ? { journeyId } : {}) }),
      });
      if (!response.ok || !response.body) throw new Error("assistant unavailable");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, text: answer } : message));
      }
      answer += decoder.decode();
      if (!answer.trim()) throw new Error("empty assistant reply");
      setMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, text: answer } : message));
    } catch {
      failed = true;
      answer = uploadError || failureText(firstUser.text);
      setMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, text: answer, failed: true } : message));
    } finally {
      const nextMessages = [...messages, userMessage, { ...assistantMessage, text: answer, ...(failed ? { failed: true } : {}) }];
      const title = conversations.find((item) => item.id === chatId)?.title ?? text.slice(0, 48);
      saveConversation({ id: chatId, title, messages: nextMessages, ...(activePaymentOrderId ? { paymentOrderId: activePaymentOrderId } : {}), ...(journeyId ? { journeyId } : {}) });
      setBusy(false);
    }
  };

  async function openPaymentSignal(signal: PaymentSignal) {
    if (busy) return;
    const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(signal.amountPaise / 100);
    const chatId = createId();
    const intro: Message = { id: createId(), role: "assistant", text: `It looks like you paid ${amount} to ${signal.hospitalName}. Would you like to check whether it may be covered? Upload a photo or PDF of your itemized bill to get started. The payment amount alone cannot establish a claim.` };
    setCurrentChatId(chatId);
    setActivePaymentOrderId(signal.orderId);
    setActiveJourneyId("");
    setInlineView(null);
    setAttachment(null);
    setMessages([intro]);
    saveConversation({ id: chatId, title: `${signal.hospitalName} payment`, messages: [intro], paymentOrderId: signal.orderId });
    setPaymentSignals((current) => current.filter((item) => item.orderId !== signal.orderId));
    await fetch("/api/payment-feed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: signal.orderId }) }).catch(() => {});
  }

  async function dismissPaymentSignal(signal: PaymentSignal) {
    await fetch("/api/payment-feed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: signal.orderId }) }).catch(() => {});
    setPaymentSignals((current) => current.filter((item) => item.orderId !== signal.orderId));
  }

  if (!onboarded) return null;

  const composer = (
    <div className="space-y-2">
    {attachment && <div className="inline-flex max-w-full items-center gap-3 rounded-xl border border-line bg-white px-3 py-2 text-left text-sm text-ink-2">
      <span aria-hidden="true">📎</span><span className="truncate">{attachment.name}</span>
      <button type="button" disabled={busy} aria-label="Remove attachment" onClick={() => setAttachment(null)} className="ml-1 rounded p-1 text-ink-2 hover:bg-cream">×</button>
    </div>}
    <form onSubmit={(event) => { event.preventDefault(); void send(draft); }} className="composer">
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,application/pdf,.pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) setAttachment(file); event.target.value = ""; setUploadMenu(false); }} />
      <div className="relative shrink-0">
      {uploadMenu && <div className="absolute bottom-full left-0 z-20 mb-2 min-w-48 rounded-xl border border-line bg-white p-1 shadow-lg"><button type="button" onClick={() => { setUploadMenu(false); fileInput.current?.click(); }} className="w-full rounded-lg px-3 py-3 text-left text-sm font-semibold text-ink hover:bg-cream">Upload image or PDF</button></div>}
      <button type="button" disabled={busy} onClick={() => setUploadMenu((open) => !open)} aria-expanded={uploadMenu} aria-label="Attach a file" title="Attach a file" className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2 transition hover:bg-cream">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5 12 20.5a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 1 1-2.8-2.8l8.3-8.3" /></svg>
      </button>
      </div>
      <select aria-label="Voice input language" value={voiceLanguage} disabled={listening || transcribing} onChange={(event) => setVoiceLanguage(event.target.value as VoiceLanguage)} className="mr-1 max-w-20 bg-transparent text-xs text-ink-2 outline-none sm:max-w-28">
        <option value="en-IN">EN voice</option>
        <option value="te-IN">తెలుగు voice</option>
        <option value="hi-IN">हिन्दी voice</option>
      </select>
      {voiceLanguage !== "en-IN" && <select aria-label="Voice transcript script" value={voiceScript} disabled={listening || transcribing} onChange={(event) => setVoiceScript(event.target.value as VoiceScript)} className="max-w-20 bg-transparent text-xs text-ink-2 outline-none"><option value="native">Native</option><option value="roman">Roman</option></select>}
      <button type="button" onClick={() => void toggleVoice()} disabled={busy || transcribing} aria-label={listening ? "Stop voice input" : "Start voice input"} title={listening ? "Stop recording" : "Speak your question"} className={`grid size-10 shrink-0 place-items-center rounded-full transition ${listening ? "bg-red-100 text-red-700" : "text-ink-2 hover:bg-cream"}`}>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>
      </button>
      <textarea
        rows={1}
        maxLength={2000}
        value={draft}
        onChange={(event) => { if (!event.target.value.trim()) inputVoiceLanguage.current = null; setDraft(event.target.value); }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft); }
        }}
        aria-label="Message Fynish"
        placeholder={listening ? "Recording… tap the mic to finish" : transcribing ? "Transcribing…" : "Ask about a policy, claim, or insurance…"}
        className="field-sizing-content max-h-40 min-w-0 flex-1 resize-none bg-transparent py-2.5 outline-none placeholder:text-ink-3"
      />
      <button type="submit" disabled={!draft.trim() || busy || listening || transcribing} aria-label="Send message" className="send-button disabled:opacity-40">
        {busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /> : <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>}
      </button>
    </form>
    </div>
  );

  return (
    <div className="app-shell">
      {menu && <button aria-label="Close menu" className="fixed inset-0 z-20 bg-ink/40 md:hidden" onClick={closeMenu} />}
      <aside id="app-sidebar" className={`app-sidebar ${menu ? "is-open" : ""}`}>
        <div className="sidebar-brand"><Wordmark className="text-3xl" /><button ref={closeButton} type="button" aria-label="Close menu" onClick={closeMenu} className="sidebar-close"><svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg></button></div>
        <button onClick={newConversation} className="new-claim" disabled={busy}>
          <span className="new-claim-icon" aria-hidden="true">+</span><span>New conversation</span>
        </button>
        <button type="button" onClick={() => openInline("transactions")} className="sidebar-intro text-left">Transaction history <span aria-hidden="true">↗</span></button>
        <button type="button" onClick={() => openInline("provider")} className="sidebar-intro text-left">Change insurance provider <span aria-hidden="true">↗</span></button>
        <div className="sidebar-recent"><p>Recent chats</p>{conversations.length ? conversations.map((conversation) => <button key={conversation.id} type="button" disabled={busy} className="sidebar-chat" onClick={() => { setCurrentChatId(conversation.id); setActivePaymentOrderId(conversation.paymentOrderId ?? ""); setActiveJourneyId(conversation.journeyId ?? ""); setInlineView(null); setAttachment(null); setUploadMenu(false); setMessages(conversation.messages); if (menu) closeMenu(); }}>{conversation.title}</button>) : <span>No conversations yet</span>}<small className="sidebar-storage-note">Saved on this device</small></div>
        <div className="sidebar-note"><span className="sidebar-note-icon" aria-hidden="true">✳</span><p>One less thing<br /><strong>to worry about.</strong></p></div>
      </aside>

      <main className="chat-main" inert={menu}>
        <CursorBackground />
        <header className="chat-header">
          <button ref={menuButton} aria-label="Open menu" aria-controls="app-sidebar" aria-expanded={menu} onClick={() => setMenu(true)} className={`menu-button ${menu ? "menu-button-hidden" : ""}`}>
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <span className="md:hidden"><Wordmark className="text-2xl" /></span>
          <div className="chat-header-title">Insurance &amp; claims</div>
        </header>

        {paymentConnected && paymentSignals.filter((signal) => signal.isHospital && !signal.seen).map((signal) => <section key={signal.orderId} role="status" className="relative z-10 mx-auto mt-2 flex w-[min(760px,calc(100%-32px))] flex-wrap items-center justify-between gap-4 rounded-2xl border border-green/20 bg-green-tint px-4 py-4 text-left sm:px-5">
          <div><p className="text-sm font-extrabold text-green">Possible hospital payment found</p><p className="mt-1 text-sm text-ink-2">It looks like you paid {signal.hospitalName}. Would you like to check whether it may be covered?</p><p className="mt-1 text-xs text-ink-2">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(signal.amountPaise / 100)} · Simulation payment</p></div>
          <div className="flex items-center gap-3"><button type="button" disabled={busy} onClick={() => void openPaymentSignal(signal)} className="rounded-lg bg-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Check claim</button><button type="button" onClick={() => void dismissPaymentSignal(signal)} className="text-xs font-semibold text-ink-2 underline underline-offset-2">Dismiss</button></div>
        </section>)}

        {messages.length === 0 ? (
          <section className="chat-empty animate-fade-up">
            <div className="greeting-mark"><Mark size={72} /></div>
            <p className="greeting-eyebrow">{customerName ? `Welcome, ${customerName}` : "Here for your next step"}</p>
            <h1>Insurance questions,<br className="hidden sm:block" /> made simpler.</h1>
            <p className="greeting-copy">Ask about policies, cover, claims, or what to do next.</p>
            <button type="button" onClick={() => fileInput.current?.click()} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue px-6 font-bold text-white">Upload a bill</button>
            <div className="chat-start">
              {composer}
              {voiceError && <p role="status" className="mt-2 text-left text-xs text-amber-ink">{voiceError}</p>}
              <p className="preview-notice">English · తెలుగు · हिन्दी</p>
              <div className="suggestions" aria-label="Suggested messages">
                {SUGGESTIONS.map((suggestion) => <button key={suggestion} onClick={() => void send(suggestion)}>{suggestion}<span aria-hidden="true">↗</span></button>)}
              </div>

            </div>
          </section>
        ) : (
          <>
            <section aria-label="Messages" aria-live="polite" className="message-scroll">
              <div className="message-list">
                <p className="conversation-label">Your conversation</p>
                {messages.map((message, index) => message.role === "user" ? (
                  <div key={message.id} className="customer-message animate-fade-up">{message.attachment && <div className="mb-2 rounded-lg bg-white/15 px-3 py-2 text-sm">📎 {message.attachment.name}</div>}<p>{message.text}</p></div>
                ) : (
                  <div key={message.id} className="agent-message animate-fade-up">
                    <span className="agent-avatar"><Mark size={30} /></span>
                    <div><p className="agent-name">Fynish</p><p className="agent-copy whitespace-pre-wrap">{message.text ? <MessageText text={message.text} /> : busy ? thinkingLabel(messages.filter((item) => item.role === "user").at(-1)?.text ?? "") : failureText("")}</p>{message.text && !(busy && index === messages.length - 1) && <VoicePlayback text={message.text} language={voiceLanguageFor(messages, index)} />}</div>
                  </div>
                ))}
                {inlineView && <div className="agent-message animate-fade-up">
                  <span className="agent-avatar"><Mark size={30} /></span>
                  <div className="min-w-0 flex-1"><div className="mb-3 flex items-center justify-between gap-3"><p className="agent-name">Fynish</p><button type="button" onClick={() => setInlineView(null)} className="text-sm font-semibold text-ink-2 underline">Close</button></div>
                    {inlineView === "transactions" ? <TransactionHistory embedded onCheckPayment={(signal) => void openPaymentSignal({ ...signal, method: null, seen: true, isHospital: true })} /> : <ClaimFlow key={`${inlineView}-${currentChatId}`} embedded changeProvider onAssessment={(journeyId) => { const snapshot = chatSnapshot.current; if (snapshot.id !== currentChatId) return; snapshot.journeyId = journeyId; setActiveJourneyId(journeyId); setInlineView(null); const title = parseChatHistory(readChatHistory()).find((item) => item.id === currentChatId)?.title ?? "Claim review"; saveConversation({ id: currentChatId, title, messages: snapshot.messages, ...(journeyId ? { journeyId } : {}), ...(snapshot.paymentOrderId ? { paymentOrderId: snapshot.paymentOrderId } : {}) }); }} />}
                  </div>
                </div>}
                <div ref={messagesEnd} />
              </div>
            </section>
            <div className="composer-dock"><div className="mx-auto max-w-180">{composer}{voiceError && <p role="status" className="mt-2 text-xs text-amber-ink">{voiceError}</p>}<p>For exact cover, share your insurer and policy details.</p></div></div>
          </>
        )}
      </main>
    </div>
  );
}
