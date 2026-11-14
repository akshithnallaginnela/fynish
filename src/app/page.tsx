"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Mark from "@/components/mark";
import Wordmark from "@/components/wordmark";
import AccountSettings, { logoutAccount } from "@/components/account-settings";
import TransactionNotifications, { type PaymentNotification } from "@/components/transaction-notifications";
import type { BankTransaction } from "@/components/simulated-bank-connect";
import CursorBackground from "@/components/cursor-background";
import { useSarvamVoice, VoicePlayback, type VoiceLanguage, type VoiceScript } from "@/components/voice-controls";
import { ONBOARDING_KEY } from "@/lib/onboarding";

type Message = { id: string; role: "user" | "assistant"; text: string; voiceLanguage?: VoiceLanguage; attachment?: { name: string }; failed?: boolean; reconnectRequired?: boolean; systemChoice?: boolean; claimReply?: boolean };
type PaymentSignal = { orderId: string; hospitalName: string; amountPaise: number; paymentId: string | null; method: string | null; paidAt: string | null; seen: boolean; isHospital: boolean };
type Conversation = { id: string; title: string; messages: Message[]; paymentOrderId?: string; journeyId?: string; saved?: boolean; pinned?: boolean };
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
  if (/\b(naaku|naku|naa|mee|ela|edi|idhi|undi|undha|chesukovali|cheyyali|cheyali|cheyava|cheyyava|chesava|cheysina|cheysthe|cheysthundi|avuthundi|kavala|ante|nenu|cheppu|nuvvu|nuvv|enti|enduku|ardham|osthundi|osthadi|asalu|ledu|ochindi)\b/u.test(lower)) return "te";
  if (/\b(mujhe|mera|meri|kaise|kya|hai|hain|chahiye|karna|ka|ki|ke|policy batao|claim kaise)\b/u.test(lower)) return "hi";
  return "en";
}

type Insurer = "star" | "hdfc-ergo";
function insurerFromReply(text: string): Insurer | null {
  const value = text.toLowerCase().trim();
  if (/[?？]/u.test(value) || value.split(/\s+/u).length > 7 || /\b(what|how|why|where|tell|explain|help|ela|enti|kaise|kya)\b/u.test(value)) return null;
  if (/\bstar(?:\s+health)?\b|స్టార్|स्टार/u.test(value)) return "star";
  if (/\bhdfc(?:[\s-]+ergo)?\b|హెచ్\s*డి\s*ఎఫ్\s*సి|एच\s*डी\s*एफ\s*सी/u.test(value)) return "hdfc-ergo";
  return null;
}

function claimSuggestions(messages: Message[]) {
  const first = messages.find((message) => message.role === "user" && !message.systemChoice)?.text ?? "";
  const lang = languageOf(first);
  if (lang === "te") return /[\u0C00-\u0C7F]/u.test(first)
    ? ["ఏ ఖర్చులు కవర్ కాకపోవచ్చు?", "నాకు ఏ పత్రాలు అవసరం?", "క్లెయిమ్ ఎలా సమర్పించాలి?"]
    : ["E kharchulu cover kakapovachu?", "Naaku e documents kavali?", "Claim ela submit cheyyali?"];
  if (lang === "hi") return /[\u0900-\u097F]/u.test(first)
    ? ["कौन से खर्च कवर नहीं हो सकते?", "मुझे कौन से दस्तावेज़ चाहिए?", "क्लेम कैसे जमा करूँ?"]
    : ["Kaunse kharche cover nahi ho sakte?", "Mujhe kaunse documents chahiye?", "Claim kaise submit karun?"];
  return ["Which costs might not be covered?", "What documents do I need?", "How do I submit the claim?"];
}

function insurerMessage(messages: Message[], kind: "ask" | "opening" | "unsupported" | "failed" | "connected" | "select", name = "") {
  const first = messages.find((message) => message.role === "user" && !message.systemChoice)?.text ?? "";
  const language = languageOf(first);
  if (language === "te") return (/[\u0C00-\u0C7F]/u.test(first) ? {
    ask: "ఏ ఇన్సూరెన్స్ సంస్థను కనెక్ట్ చేయాలనుకుంటున్నారు? Star Health లేదా HDFC ERGO అని టైప్ చేయండి.", opening: `${name} ఖాతా అనుకరణను తెరుస్తున్నాను.`, unsupported: "Star Health లేదా HDFC ERGO అని టైప్ చేయండి.", failed: "ఇన్సూరెన్స్ కనెక్షన్ పూర్తి కాలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.", connected: `${name} ఖాతా అనుకరణ కనెక్ట్ అయింది; పాలసీ ఎంపికైంది. మీకు ఎలా సహాయపడగలను?`, select: `${name} ఖాతా అనుకరణ కనెక్ట్ అయింది. దయచేసి ఖాతా సెట్టింగ్స్‌లో పాలసీని ఎంచుకోండి.`,
  } : {
    ask: "E insurance provider ni connect cheyyali? Star Health leda HDFC ERGO ani type cheyyandi.", opening: `${name} account simulation open chesthunnanu.`, unsupported: "Star Health leda HDFC ERGO ani type cheyyandi.", failed: "Insurance connection complete avvaledu. Malli try cheyyandi.", connected: `${name} account simulation connect ayi policy select ayyindi. Ela help cheyyali?`, select: `${name} account simulation connect ayyindi. Account settings lo policy select cheyyandi.`,
  })[kind];
  if (language === "hi") return (/[\u0900-\u097F]/u.test(first) ? {
    ask: "किस बीमा प्रदाता को जोड़ना चाहेंगे? Star Health या HDFC ERGO टाइप करें।", opening: `${name} खाता सिमुलेशन खोल रहा हूँ।`, unsupported: "Star Health या HDFC ERGO टाइप करें।", failed: "बीमा कनेक्शन पूरा नहीं हुआ। फिर कोशिश करें।", connected: `${name} खाता सिमुलेशन जुड़ गया और पॉलिसी चुन ली गई। मैं कैसे मदद करूँ?`, select: `${name} खाता सिमुलेशन जुड़ गया। खाता सेटिंग में पॉलिसी चुनें।`,
  } : {
    ask: "Kaunsa insurer connect karna hai? Star Health ya HDFC ERGO type karein.", opening: `${name} account simulation khol raha hoon.`, unsupported: "Star Health ya HDFC ERGO type karein.", failed: "Insurance connection poora nahi hua. Phir koshish karein.", connected: `${name} account simulation connect hua aur policy select ho gayi. Main kaise madad karun?`, select: `${name} account simulation connect hua. Account settings mein policy select karein.`,
  })[kind];
  return { ask: "Which insurance provider would you like to connect? Type Star Health or HDFC ERGO.", opening: `Opening the ${name} account simulation.`, unsupported: "I can connect the Star Health and HDFC ERGO account simulations. Please type one of those insurer names.", failed: "The insurer connection did not finish. Please try again.", connected: `${name} account simulation connected and your policy is selected. How can I help?`, select: `${name} account simulation connected. Please select your policy in account settings.` }[kind];
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

function reconnectLabel(text: string) {
  const language = languageOf(text);
  if (language === "te") return /[\u0C00-\u0C7F]/u.test(text) ? "బీమా కనెక్షన్‌ను మళ్లీ కలపండి" : "Insurance ni malli connect cheyyandi";
  if (language === "hi") return /[\u0900-\u097F]/u.test(text) ? "बीमा कनेक्शन फिर से जोड़ें" : "Insurance connection phir se jodein";
  return "Reconnect insurer";
}

function claimContextFailureText(text: string) {
  const language = languageOf(text);
  if (language === "te") return /[\u0C00-\u0C7F]/u.test(text) ? "మీ బిల్లు పరిశీలన ఇప్పుడు అందుబాటులో లేదు. కాసేపటి తర్వాత మళ్లీ ప్రయత్నించండి." : "Mee bill assessment ippudu available ledu. Kasepati tarvata malli try cheyyandi.";
  if (language === "hi") return /[\u0900-\u097F]/u.test(text) ? "आपके बिल का आकलन अभी उपलब्ध नहीं है। थोड़ी देर बाद फिर कोशिश करें।" : "Aapke bill ka assessment abhi available nahi hai. Thodi der baad phir koshish karein.";
  return "Your bill assessment is temporarily unavailable. Please try again shortly.";
}

function billFailureText(status: number, detail: string, reference: string, code = "") {
  const kind = code === "connection_expired" ? "expired" : code === "provider_unavailable" || code === "provider_api_error" ? "provider" : status === 409 || (/policy/i.test(detail) && /reconnect/i.test(detail)) ? "policy" : status === 413 ? "size" : status === 415 ? "format"
    : status >= 500 || status === 0 ? "service" : /date/i.test(detail) ? "dates" : "document";
  const language = languageOf(reference);
  const native = language === "te" ? /[\u0C00-\u0C7F]/u.test(reference) : /[\u0900-\u097F]/u.test(reference);
  const messages = language === "te" ? native ? {
    policy: "ముందుగా మీ ఇన్సూరెన్స్ పాలసీని కనెక్ట్ చేసి ఎంచుకోండి. ఫైల్ అలాగే ఉంటుంది.",
    expired: "మీ ఇన్సూరెన్స్ సెషన్ ముగిసింది. ప్రొవైడర్‌ను మళ్లీ కనెక్ట్ చేసి ప్రయత్నించండి.",
    provider: "ఇన్సూరెన్స్ ప్రొవైడర్ ప్రస్తుతం అందుబాటులో లేరు. కాసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.",
    size: "10 MB లోపు ఖాళీగా లేని ఫైల్‌ను ఎంచుకోండి.",
    format: "JPEG, PNG, WebP చిత్రం లేదా PDF ఎంచుకోండి.",
    dates: "బిల్లులో తేదీలు చదవలేకపోయాను. తేదీలు కనిపించే కాపీని ఎంచుకోండి.",
    document: "బిల్లు చదవలేకపోయాను. స్పష్టమైన చిత్రం లేదా PDFతో మళ్లీ ప్రయత్నించండి.",
    service: "ప్రస్తుతం బిల్లును పరిశీలించే సేవ అందుబాటులో లేదు. ఫైల్ అలాగే ఉంది; కాసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.",
  } : {
    policy: "Munduga mee insurance policy ni connect chesi select cheyyandi. File alage untundi.",
    expired: "Mee insurance session expire ayyindi. Provider ni malli connect chesi try cheyyandi.",
    provider: "Insurance provider ippudu available ledu. Kasepati tarvata malli try cheyyandi.",
    size: "10 MB lopu unna file ni select cheyyandi.",
    format: "JPEG, PNG, WebP image leda PDF select cheyyandi.",
    dates: "Bill lo dates chadavalekapoyanu. Dates kanipinche copy select cheyyandi.",
    document: "Bill chadavalekapoyanu. Clear image leda PDF tho malli try cheyyandi.",
    service: "Bill check chese service ippudu available ledu. File alage undi; kasepati tarvata malli try cheyyandi.",
  } : language === "hi" ? native ? {
    policy: "पहले अपनी बीमा पॉलिसी कनेक्ट करके चुनें। फ़ाइल लगी रहेगी।", expired: "बीमा सत्र समाप्त हो गया है। प्रदाता को फिर से कनेक्ट करें।", provider: "बीमा प्रदाता अभी उपलब्ध नहीं है। थोड़ी देर बाद कोशिश करें।", size: "10 MB से छोटी फ़ाइल चुनें।",
    format: "JPEG, PNG, WebP तस्वीर या PDF चुनें।", dates: "बिल की तारीखें पढ़ नहीं पाया। तारीखें दिखने वाली प्रति चुनें।",
    document: "बिल पढ़ नहीं पाया। साफ़ तस्वीर या PDF से फिर कोशिश करें।", service: "बिल जाँच सेवा अभी उपलब्ध नहीं है। फ़ाइल लगी है; थोड़ी देर बाद फिर कोशिश करें।",
  } : {
    policy: "Pehle apni insurance policy connect karke select karein. File lagi rahegi.", expired: "Insurance session expire ho gaya. Provider ko phir connect karein.", provider: "Insurance provider abhi available nahi hai. Thodi der baad koshish karein.", size: "10 MB se chhoti file select karein.",
    format: "JPEG, PNG, WebP image ya PDF select karein.", dates: "Bill ki dates padh nahi paya. Dates dikhne wali copy select karein.",
    document: "Bill padh nahi paya. Clear image ya PDF ke saath phir koshish karein.", service: "Bill check karne ki service abhi available nahi hai. File lagi hai; thodi der baad phir koshish karein.",
  } : {
    policy: "Please connect and select your insurance policy first. Your file will stay attached.", expired: "Your insurance session has expired. Reconnect your provider and try again.", provider: "Your insurance provider is temporarily unavailable. Please try again shortly.", size: "Please choose a non-empty file smaller than 10 MB.",
    format: "Please choose a JPEG, PNG, WebP image or PDF.", dates: "I couldn't read the bill dates. Please choose a copy where they are visible.",
    document: "I couldn't read the bill. Please try again with a clear image or PDF.", service: "The bill checking service is unavailable right now. Your file is still attached; please try again shortly.",
  };
  return messages[kind];
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
  const [inlineView, setInlineView] = useState<"account" | null>(null);
  const [providerPrompt, setProviderPrompt] = useState(false);
  const [providerLogin, setProviderLogin] = useState<{ provider: Insurer; url: string; chatId: string } | null>(null);
  const providerFrame = useRef<HTMLIFrameElement>(null);
  const chatSnapshot = useRef({ id: "", messages: [] as Message[], paymentOrderId: "", journeyId: "" });
  const [historyOverride, setHistoryOverride] = useState<Conversation[] | null>(null);
  const [showSavedChats, setShowSavedChats] = useState(false);
  const [historyStorageError, setHistoryStorageError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [signOutPartial, setSignOutPartial] = useState(false);
  const savedHistory = useSyncExternalStore(subscribeToProfile, readChatHistory, () => "[]");
  const conversations = historyOverride ?? parseChatHistory(savedHistory);
  const [busy, setBusy] = useState(false);
  const [pendingNotification, setPendingNotification] = useState<PaymentNotification | null>(null);
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
  const messagesEnd = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const paymentHandoff = useRef("");

  const saveConversation = useCallback((conversation: Conversation) => {
    const stored = parseChatHistory(readChatHistory());
    const previous = stored.find((item) => item.id === conversation.id) ?? historyOverride?.find((item) => item.id === conversation.id);
    const existing = stored.length ? stored : historyOverride ?? [];
    let regularCount = 0;
    const updated = [{ ...previous, ...conversation }, ...existing.filter((item) => item.id !== conversation.id)]
      .filter((item) => item.saved || item.pinned || regularCount++ < 30);
    setHistoryOverride(updated);
    try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updated)); setHistoryStorageError(false); }
    catch { setHistoryStorageError(true); }
  }, [historyOverride]);

  const beginPaymentChat = useCallback((merchantName: string, amountPaise: number, orderId?: string, simulated = false) => {
    const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amountPaise / 100);
    const chatId = createId();
    const question: Message = { id: createId(), role: "user", text: `Please check whether my ${amount} payment to ${merchantName} may be covered by my policy.`, attachment: { name: `${simulated ? "Simulated payment" : "Payment"} · ${merchantName} · ${amount}` }, systemChoice: true };
    const intro: Message = { id: createId(), role: "assistant", text: "Please upload the related itemised bill as an image or PDF. I’ll check it against your connected policy and explain what may be covered." };
    setCurrentChatId(chatId); setActivePaymentOrderId(orderId ?? ""); setActiveJourneyId(""); setInlineView(null); setProviderPrompt(false); setAttachment(null); setDraft("");
    setMessages([question, intro]);
    saveConversation({ id: chatId, title: `${merchantName} payment`, messages: [question, intro], ...(orderId ? { paymentOrderId: orderId } : {}) });
  }, [saveConversation]);

  useEffect(() => {
    if (busy || !pendingNotification) return;
    const timer = window.setTimeout(() => {
      beginPaymentChat(pendingNotification.hospitalName, pendingNotification.amountPaise, pendingNotification.orderId);
      setPendingNotification(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [busy, pendingNotification, beginPaymentChat]);

  const toggleChatFlag = (id: string, flag: "saved" | "pinned") => {
    const updated = conversations.map((item) => item.id === id ? { ...item, [flag]: !item[flag] } : item);
    setHistoryOverride(updated);
    try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updated)); setHistoryStorageError(false); }
    catch { setHistoryStorageError(true); }
  };

  const signOut = async () => {
    if (signingOut || busy) return;
    setSigningOut(true);
    setSignOutError("");
    setSignOutPartial(false);
    try {
      const result = await logoutAccount();
      if (result === "complete") {
        window.dispatchEvent(new Event("storage"));
        router.replace("/welcome");
      } else if (result === "provider-revocation-failed") {
        setSignOutPartial(true);
        setSignOutError("Signed out on this device, but the insurer connection could not be revoked. Please contact support.");
      } else {
        setSignOutError("Signed out of the session, but the profile could not be removed. Clear this site's stored data in your browser settings.");
      }
    } catch {
      setSignOutError("Sign out could not finish. Check your connection and try again.");
    } finally { setSigningOut(false); }
  };

  const newConversation = () => {
    if (busy) return;
    setCurrentChatId("");
    setActivePaymentOrderId("");
    setActiveJourneyId("");
    setInlineView(null);
    setProviderPrompt(false);
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

  const openInline = (view: "provider" | "transactions" | "account") => {
    if (busy) return;
    if (view === "transactions") { router.push("/transactions"); if (menu) closeMenu(); return; }
    const chatId = currentChatId || createId();
    const text = view === "provider" ? insurerMessage(messages, "ask") : "Here are your account settings.";
    const intro: Message = { id: createId(), role: "assistant", text };
    const nextMessages = [...messages, intro];
    setCurrentChatId(chatId);
    setMessages(nextMessages);
    setProviderPrompt(view === "provider");
    setInlineView(view === "account" ? "account" : null);
    const title = conversations.find((item) => item.id === chatId)?.title ?? (view === "provider" ? "Insurance provider" : "Account settings");
    saveConversation({ id: chatId, title, messages: nextMessages, ...(activeJourneyId ? { journeyId: activeJourneyId } : {}), ...(activePaymentOrderId ? { paymentOrderId: activePaymentOrderId } : {}) });
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
    if (onboarded !== true) return;
    const query = new URLSearchParams(window.location.search);
    const bankId = query.get("bankTransaction");
    const orderId = query.get("paymentOrderId");
    const key = bankId ? `bank:${bankId}` : orderId ? `checkout:${orderId}` : "";
    if (!key || paymentHandoff.current === key) return;
    paymentHandoff.current = key;
    void (async () => {
      try {
        if (bankId) {
          const response = await fetch("/api/bank/transactions", { cache: "no-store" });
          const body = await response.json();
          const transaction = response.ok && Array.isArray(body.transactions) ? body.transactions.find((item: BankTransaction) => item.id === bankId) as BankTransaction | undefined : undefined;
          if (!transaction) throw new Error("payment unavailable");
          beginPaymentChat(transaction.merchantName, transaction.amountPaise, undefined, true);
        } else if (orderId) {
          const response = await fetch(`/api/payment-feed?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store" });
          const body = await response.json();
          const signal = response.ok && Array.isArray(body.signals) ? body.signals.find((item: PaymentSignal) => item.orderId === orderId) as PaymentSignal | undefined : undefined;
          if (!signal) throw new Error("payment unavailable");
          beginPaymentChat(signal.hospitalName, signal.amountPaise, signal.orderId, false);
          void fetch("/api/payment-feed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: signal.orderId }) }).catch(() => {});
        }
      } catch {
        const message: Message = { id: createId(), role: "assistant", text: "I couldn't find this payment in your connected account. Please open transaction history and try again." };
        setCurrentChatId(""); setActivePaymentOrderId(""); setActiveJourneyId(""); setMessages([message]);
      } finally { router.replace("/"); }
    })();
  }, [onboarded, router, beginPaymentChat]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [messages, busy, inlineView]);

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

  useEffect(() => {
    if (!providerLogin) return;
    let handled = false;
    const onMessage = (event: MessageEvent) => {
      if (handled || event.origin !== window.location.origin || event.source !== providerFrame.current?.contentWindow) return;
      if (event.data?.type !== "fynish-provider-connected" && event.data?.type !== "fynish-provider-error") return;
      handled = true;
      setProviderLogin(null);
      void (async () => {
        let text = insurerMessage(chatSnapshot.current.messages, "failed");
        let connected = false;
        if (event.data.type === "fynish-provider-connected") {
          setBusy(true);
          try {
            const response = await fetch("/api/provider/session", { cache: "no-store" });
            let session = await response.json();
            if (!response.ok || !session.connected || session.provider !== providerLogin.provider) throw new Error("connection unavailable");
            if (!session.selectedPolicyId && Array.isArray(session.policies) && session.policies.length === 1) {
              const selected = await fetch("/api/provider/select", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ policyId: session.policies[0].id }) });
              if (!selected.ok) throw new Error("policy unavailable");
              session = await selected.json();
            }
            const name = providerLogin.provider === "star" ? "Star Health" : "HDFC ERGO";
            text = insurerMessage(chatSnapshot.current.messages, session.selectedPolicyId ? "connected" : "select", name);
            try { const profile = JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? "{}"); localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ ...profile, provider: providerLogin.provider })); window.dispatchEvent(new Event("storage")); } catch { /* Connection remains valid for this session. */ }
            connected = true;
          } catch { text = insurerMessage(chatSnapshot.current.messages, "failed"); }
          finally { setBusy(false); }
        }
        const snapshot = chatSnapshot.current;
        if (snapshot.id !== providerLogin.chatId) return;
        const nextMessages: Message[] = [...snapshot.messages, { id: createId(), role: "assistant", text }];
        setMessages(nextMessages);
        if (connected) setActiveJourneyId(""); else setProviderPrompt(true);
        const title = parseChatHistory(readChatHistory()).find((item) => item.id === snapshot.id)?.title ?? "Insurance provider";
        saveConversation({ id: snapshot.id, title, messages: nextMessages, ...(!connected && snapshot.journeyId ? { journeyId: snapshot.journeyId } : { journeyId: undefined }), ...(snapshot.paymentOrderId ? { paymentOrderId: snapshot.paymentOrderId } : {}) });
      })();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [providerLogin, saveConversation]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy || listening || transcribing) return;
    if (providerPrompt) {
      const provider = insurerFromReply(text);
      if (provider) {
        const userMessage: Message = { id: createId(), role: "user", text };
        const reply: Message = { id: createId(), role: "assistant", text: insurerMessage(messages, "opening", provider === "star" ? "Star Health" : "HDFC ERGO") };
        const nextMessages = [...messages, userMessage, reply];
        const chatId = currentChatId || createId();
        setCurrentChatId(chatId); setMessages(nextMessages); setDraft(""); setProviderPrompt(false); setBusy(true);
        saveConversation({ id: chatId, title: conversations.find((item) => item.id === chatId)?.title ?? "Insurance provider", messages: nextMessages, ...(activeJourneyId ? { journeyId: activeJourneyId } : {}), ...(activePaymentOrderId ? { paymentOrderId: activePaymentOrderId } : {}) });
        try {
          const response = await fetch("/api/provider/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider }) });
          const result = await response.json();
          if (!response.ok || typeof result.url !== "string") throw new Error("connection unavailable");
          setProviderLogin({ provider, url: result.url, chatId });
        } catch {
          setProviderPrompt(true);
          const error: Message = { id: createId(), role: "assistant", text: insurerMessage(messages, "failed") };
          const failedMessages = [...nextMessages, error];
          setMessages(failedMessages);
          saveConversation({ id: chatId, title: conversations.find((item) => item.id === chatId)?.title ?? "Insurance provider", messages: failedMessages, ...(activeJourneyId ? { journeyId: activeJourneyId } : {}), ...(activePaymentOrderId ? { paymentOrderId: activePaymentOrderId } : {}) });
        } finally { setBusy(false); }
        return;
      }
      if (!attachment && text.split(/\s+/u).length <= 3 && !/[?？]/u.test(text) && !/\b(what|how|why|where|tell|explain|help|ela|enti|kaise|kya)\b/iu.test(text)) {
        const userMessage: Message = { id: createId(), role: "user", text };
        const reply: Message = { id: createId(), role: "assistant", text: insurerMessage(messages, "unsupported") };
        const nextMessages = [...messages, userMessage, reply];
        setMessages(nextMessages); setDraft("");
        saveConversation({ id: currentChatId, title: conversations.find((item) => item.id === currentChatId)?.title ?? "Insurance provider", messages: nextMessages, ...(activeJourneyId ? { journeyId: activeJourneyId } : {}), ...(activePaymentOrderId ? { paymentOrderId: activePaymentOrderId } : {}) });
        return;
      }
      setProviderPrompt(false);
    }
    const userMessage: Message = { id: createId(), role: "user", text, ...(inputVoiceLanguage.current ? { voiceLanguage: inputVoiceLanguage.current } : {}), ...(attachment ? { attachment: { name: attachment.name } } : {}) };
    inputVoiceLanguage.current = null;
    const assistantMessage: Message = { id: createId(), role: "assistant", text: "" };
    const chatId = currentChatId || createId();
    if (!currentChatId) setCurrentChatId(chatId);
    const firstUser = [...messages, userMessage].find((message) => message.role === "user" && !message.systemChoice)!;
    const detectedLanguage = languageOf(firstUser.text);
    const language = detectedLanguage === "en" && firstUser.voiceLanguage ? firstUser.voiceLanguage.slice(0, 2) : detectedLanguage;
    const script = language === "te" ? (/[\u0C00-\u0C7F]/u.test(firstUser.text) ? "native" : "roman") : language === "hi" ? (/[\u0900-\u097F]/u.test(firstUser.text) ? "native" : "roman") : "native";
    const history = [...messages.filter((message) => !message.failed && message.text.trim()), userMessage].slice(-12).map(({ role, text: content }) => ({ role, content: content.slice(0, 2000) }));
    const claimQuestion = !!attachment || /\b(claim|cover|covered|policy|insurance|insurer|bill|hospital|document|receipt|reimbursement|cashless|copay|deductible|premium)\b/iu.test(text);
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setDraft("");
    setVoiceError("");
    setInlineView(null);
    setUploadMenu(false);
    setBusy(true);
    let answer = "";
    let failed = false;
    let reconnectRequired = false;
    let journeyId = activeJourneyId;
    let uploadError = "";
    try {
      if (attachment) {
        const form = new FormData();
        form.set("bill", attachment);
        if (activePaymentOrderId) form.set("paymentOrderId", activePaymentOrderId);
        uploadError = billFailureText(0, "", firstUser.text);
        const result = await fetch("/api/claim/analyze", { method: "POST", body: form });
        if (!result.ok) {
          const body = await result.json().catch(() => ({})) as { error?: string; code?: string };
          reconnectRequired = body.code === "connection_expired";
          uploadError = billFailureText(result.status, typeof body.error === "string" ? body.error : "", firstUser.text, body.code);
          throw new Error("bill upload failed");
        }
        uploadError = "";
        const analysis: { journeyId?: string } = await result.json();
        if (!analysis.journeyId) throw new Error("bill analysis unavailable");
        journeyId = analysis.journeyId;
        setActiveJourneyId(journeyId);
        setAttachment(null);
      }
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history, language, script, ...(journeyId ? { journeyId } : {}), ...(attachment ? { billAttached: true } : {}) }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { code?: string };
        if (body.code === "claim_context_unavailable") uploadError = claimContextFailureText(firstUser.text);
        throw new Error("assistant unavailable");
      }
      if (!response.body) throw new Error("assistant unavailable");
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
      setMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, text: answer, claimReply: !!journeyId && claimQuestion } : message));
    } catch {
      failed = true;
      answer = uploadError || failureText(firstUser.text);
      setDraft((current) => current.trim() ? current : text);
      setMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, text: answer, failed: true, ...(reconnectRequired ? { reconnectRequired: true } : {}) } : message));
    } finally {
      const nextMessages = [...messages, userMessage, { ...assistantMessage, text: answer, ...(failed ? { failed: true } : {}), ...(reconnectRequired ? { reconnectRequired: true } : {}), ...(!failed && journeyId && claimQuestion ? { claimReply: true } : {}) }];
      const title = conversations.find((item) => item.id === chatId)?.title ?? text.slice(0, 48);
      saveConversation({ id: chatId, title, messages: nextMessages, ...(activePaymentOrderId ? { paymentOrderId: activePaymentOrderId } : {}), ...(journeyId ? { journeyId } : {}) });
      setBusy(false);
    }
  };

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

  const sidebarConversations = showSavedChats ? conversations.filter((item) => item.saved) : conversations;
  const pinnedConversations = sidebarConversations.filter((item) => item.pinned);
  const otherConversations = sidebarConversations.filter((item) => !item.pinned);
  const chatRow = (conversation: Conversation) => (
    <div key={conversation.id} className="flex min-w-0 items-center gap-0.5">
      <button type="button" disabled={busy} className="sidebar-chat !w-auto min-w-0 flex-1" aria-current={conversation.id === currentChatId ? "page" : undefined} onClick={() => { setCurrentChatId(conversation.id); setActivePaymentOrderId(conversation.paymentOrderId ?? ""); setActiveJourneyId(conversation.journeyId ?? ""); setInlineView(null); setProviderPrompt(false); setAttachment(null); setUploadMenu(false); setMessages(conversation.messages); if (menu) closeMenu(); }}>{conversation.title}</button>
      <button type="button" onClick={() => toggleChatFlag(conversation.id, "pinned")} aria-pressed={!!conversation.pinned} aria-label={`${conversation.pinned ? "Unpin" : "Pin"} ${conversation.title}`} title={conversation.pinned ? "Unpin chat" : "Pin chat"} className={`grid size-8 shrink-0 place-items-center rounded-lg hover:bg-white focus-visible:outline-2 focus-visible:outline-blue ${conversation.pinned ? "text-blue" : "text-ink-3"}`}><svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 3 6 0-1 5 3 3v2H7v-2l3-3-1-5ZM12 13v8" /></svg></button>
      <button type="button" onClick={() => toggleChatFlag(conversation.id, "saved")} aria-pressed={!!conversation.saved} aria-label={`${conversation.saved ? "Remove from saved chats" : "Save chat"}: ${conversation.title}`} title={conversation.saved ? "Remove from saved chats" : "Save chat"} className={`grid size-8 shrink-0 place-items-center rounded-lg hover:bg-white focus-visible:outline-2 focus-visible:outline-blue ${conversation.saved ? "text-blue" : "text-ink-3"}`}><svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill={conversation.saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4V3Z" /></svg></button>
    </div>
  );

  return (
    <div className="app-shell">
      {providerLogin && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) { setProviderLogin(null); setProviderPrompt(true); } }} onKeyDown={(event) => { if (event.key === "Escape") { setProviderLogin(null); setProviderPrompt(true); } }}>
        <section role="dialog" aria-modal="true" aria-labelledby="chat-provider-title" className="flex h-[min(760px,94dvh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><div><h2 id="chat-provider-title" className="font-bold">Sign in to {providerLogin.provider === "star" ? "Star Health" : "HDFC ERGO"}</h2><p className="text-xs text-ink-3">Fynish account simulation</p></div><button type="button" aria-label="Close sign-in" onClick={() => { setProviderLogin(null); setProviderPrompt(true); }} className="grid size-9 place-items-center rounded-full text-xl text-ink-2 hover:bg-cream">×</button></div>
          <iframe ref={providerFrame} title="Insurance account simulation" src={providerLogin.url} className="min-h-0 w-full flex-1 border-0 bg-white" />
        </section>
      </div>}
      {menu && <button aria-label="Close menu" className="fixed inset-0 z-20 bg-ink/40 md:hidden" onClick={closeMenu} />}
      <aside id="app-sidebar" className={`app-sidebar ${menu ? "is-open" : ""}`}>
        <div className="sidebar-brand"><Wordmark className="text-3xl" /><button ref={closeButton} type="button" aria-label="Close menu" onClick={closeMenu} className="sidebar-close"><svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg></button></div>
        <button onClick={newConversation} className="new-claim" disabled={busy}>
          <span className="new-claim-icon" aria-hidden="true">+</span><span>New conversation</span>
        </button>
        <button type="button" onClick={() => openInline("transactions")} disabled={busy} className="sidebar-intro text-left disabled:opacity-50">Transaction history <span aria-hidden="true">↗</span></button>
        <button type="button" onClick={() => openInline("provider")} disabled={busy} className="sidebar-intro text-left disabled:opacity-50">Change insurance provider <span aria-hidden="true">↗</span></button>
        <button type="button" onClick={() => openInline("account")} disabled={busy} className="sidebar-intro text-left disabled:opacity-50">Account settings <span aria-hidden="true">↗</span></button>
        <button type="button" onClick={() => setShowSavedChats((current) => !current)} aria-pressed={showSavedChats} className="sidebar-intro text-left">{showSavedChats ? "All chats" : "Saved chats"} <span aria-hidden="true">↗</span></button>
        <div className="sidebar-recent">
          {pinnedConversations.length > 0 && <><p>Pinned chats</p>{pinnedConversations.map(chatRow)}</>}
          {otherConversations.length > 0 && <><p className={pinnedConversations.length ? "mt-5" : ""}>{showSavedChats ? "Saved chats" : "Recent chats"}</p>{otherConversations.map(chatRow)}</>}
          {sidebarConversations.length === 0 && <><p>{showSavedChats ? "Saved chats" : "Recent chats"}</p><span>{showSavedChats ? "No saved chats yet. Use the bookmark on a chat to save it." : "No conversations yet"}</span></>}
          <small className="sidebar-storage-note">{historyStorageError ? "Could not save changes on this device." : "Chats are stored on this device."}</small>
        </div>
        <div className="mt-auto px-3 pb-4">
          <button type="button" onClick={() => void signOut()} disabled={busy || signingOut || signOutPartial} className="w-full rounded-lg px-2 py-2 text-left text-sm font-semibold text-ink-2 hover:bg-white disabled:opacity-50">{signingOut ? "Signing out…" : "Sign out"}</button>
          <p className="mt-1 px-2 text-xs leading-5 text-ink-3">Chats stay on this device. Claim details from this session cannot be reopened after sign out.</p>
          {signOutError && <p role="alert" className="mt-2 px-2 text-xs leading-5 text-red-700">{signOutError}</p>}
          {signOutPartial && <button type="button" onClick={() => { window.dispatchEvent(new Event("storage")); router.replace("/welcome"); }} className="mt-2 px-2 text-xs font-bold text-blue underline">Continue to welcome</button>}
        </div>
      </aside>

      <main className="chat-main" inert={menu}>
        <CursorBackground />
        <header className="chat-header">
          <button ref={menuButton} aria-label="Open menu" aria-controls="app-sidebar" aria-expanded={menu} onClick={() => setMenu(true)} className={`menu-button ${menu ? "menu-button-hidden" : ""}`}>
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <span className="md:hidden"><Wordmark className="text-2xl" /></span>
          <div className="chat-header-title">Insurance &amp; claims</div>
          <TransactionNotifications onOpenTransaction={(payment) => { if (busy) setPendingNotification(payment); else beginPaymentChat(payment.hospitalName, payment.amountPaise, payment.orderId); }} />
        </header>

        {pendingNotification && <p role="status" className="relative z-10 mx-auto rounded-xl bg-white px-4 py-2 text-sm text-ink-2">Opening the payment chat after this reply finishes…</p>}

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
                    <div><p className="agent-name">Fynish</p><p className="agent-copy whitespace-pre-wrap">{message.text ? <MessageText text={message.text} /> : busy ? thinkingLabel(messages.filter((item) => item.role === "user").at(-1)?.text ?? "") : failureText("")}</p>{(message.reconnectRequired || /insurance session (?:has )?expired|insurance session expire|insurance connection expired/i.test(message.text)) && !busy && <button type="button" onClick={() => openInline("provider")} className="mt-3 rounded-full border border-blue px-4 py-2 text-sm font-semibold text-blue hover:bg-blue-tint">{reconnectLabel(message.text)}</button>}{message.text && !(busy && index === messages.length - 1) && <VoicePlayback text={message.text} language={voiceLanguageFor(messages, index)} />}{message.claimReply && index === messages.length - 1 && !busy && <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested follow-up questions">{claimSuggestions(messages).map((suggestion) => <button type="button" key={suggestion} onClick={() => void send(suggestion)} className="rounded-full border border-line bg-white px-3 py-2 text-left text-xs font-semibold text-ink-2 hover:border-blue hover:text-blue">{suggestion}</button>)}</div>}</div>
                  </div>
                ))}
                {inlineView && <div className="agent-message animate-fade-up">
                  <span className="agent-avatar"><Mark size={30} /></span>
                  <div className="min-w-0 flex-1"><div className="mb-3 flex items-center justify-between gap-3"><p className="agent-name">Fynish</p><button type="button" onClick={() => setInlineView(null)} className="text-sm font-semibold text-ink-2 underline">Close</button></div>
                    <AccountSettings onChangeProvider={() => openInline("provider")} onManagePayments={() => openInline("transactions")} />
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
