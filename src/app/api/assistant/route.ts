import { z } from "zod";
import { findFaqContext } from "@/lib/assistant/faq";
import { policyContext } from "@/lib/assistant/policy-context";
import { readSessionId } from "@/lib/provider/session";

const Body = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(2_000),
  })).min(1).max(12),
  journeyId: z.string().uuid().optional(),
  billAttached: z.boolean().optional(),
  language: z.enum(["en", "te", "hi"]).optional(),
  script: z.enum(["native", "roman"]).optional(),
}).strict();

const systemPrompt = `You are Fynish, a clear and capable guide for health insurance, insurance claims, policies, premiums, and related personal-finance questions in India. Answer the user's actual question directly and naturally. Be helpful across insurers and general insurance topics.

LANGUAGE AND SCRIPT:
- Answer in the conversation's original language and script as specified in the next instruction.
- If the user writes Telugu in Telugu script, answer in Telugu script.
- If the user writes Telugu using Latin letters (Roman Telugu), answer in Roman Telugu using Latin letters.
- If the user writes Hindi in Devanagari, answer in Devanagari Hindi.
- If the user writes Hindi using Latin letters (Roman Hindi/Hinglish), answer in Roman Hindi using Latin letters.
- If the conversation started in English, answer in English.
- Keep names, policy terms, dates, clause numbers, and rupee amounts exactly as provided. Never translate or change numbers.
- Do not announce language detection, models, APIs, data connections, or internal tools. Sound like Fynish, the user's insurance and claims assistant.

ACCURACY:
- Explain general concepts such as cashless vs reimbursement, sum insured, co-pay, deductible, waiting period, exclusions, renewal, portability, and documents in plain language.
- Do not invent insurer-specific coverage, current regulations, policy terms, FAQs, or claim outcomes. Ask which insurer/product or request the relevant policy wording when needed.
- Use the supplied public FAQ notes only as general HDFC ERGO information. They do not override a customer's policy schedule. When using one, include its supplied source title and URL. Do not invent citations.
- Claim estimates are provisional; only the insurer decides the claim. Never mention internal scores or promise approval or a payout.
- When a bill assessment is supplied, use its extracted bill and policy facts to answer the user's question. If asked for a claim overview, give the policy cover, estimated claim and remaining cover; do not invent an unavailable amount. Show only policy references for which actual wording is supplied.
- Help users prepare for an insurer conversation: distinguish their requested amount from a verified entitlement, identify relevant bill items and supplied policy clauses, and suggest asking for an itemised calculation, written reasons, missing documents, and the insurer's review process. If information is missing, say so and ask for it. Never suggest exaggerating charges or inventing evidence.
- Fynish's HDFC ERGO wording is synthetic. Describe it as synthetic wording if asked about that policy.
- Answer general questions naturally and helpfully without forcing insurance or claim details into an unrelated reply. Say when current information or professional advice is needed, and do not present guesses as facts.
- Do not ask for passwords, one-time codes, or payment credentials. Keep answers concise, warm, and easy to act on.`;

function replyStyle(message: string) {
  if (/[\u0C00-\u0C7F]/u.test(message)) return "The conversation started in Telugu script. Reply in Telugu script.";
  if (/[\u0900-\u097F]/u.test(message)) return "The conversation started in Devanagari. Reply in Devanagari Hindi.";
  const words = message.toLocaleLowerCase().match(/[a-z]+/gu) ?? [];
  const teluguWords = new Set(["naaku", "naku", "meeru", "nuvvu", "nuvv", "ela", "undi", "cheyyali", "cheyali", "cheysthundi", "chesukovali", "avuthundi", "kavala", "ante", "nenu", "cheppu", "em", "enduku", "enti", "edi", "osthundi", "osthadi", "ardham", "asalu", "ledu", "andi", "unnaru"]);
  const hindiWords = new Set(["mujhe", "mera", "meri", "kaise", "kya", "hai", "hain", "chahiye", "karna", "karu", "ka", "ki", "ke", "aap", "aur", "mein", "batao", "nahi", "karo"]);
  const teScore = words.filter((word) => teluguWords.has(word)).length;
  const hiScore = words.filter((word) => hindiWords.has(word)).length;
  if (teScore >= 1 && teScore >= hiScore) return "The conversation started in Roman Telugu. Reply in Roman Telugu using Latin letters.";
  if (hiScore >= 2) return "The conversation started in Roman Hindi. Reply in Roman Hindi using Latin letters.";
  return "The conversation started in English. Reply in English.";
}

export async function POST(request: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "Send a message to continue." }, { status: 400 });
  }

  if (parsed.messages.at(-1)?.role !== "user") {
    return Response.json({ error: "The latest message must be from you." }, { status: 400 });
  }

  const base = process.env.OLLAMA_BASE_URL
    ? `${process.env.OLLAMA_BASE_URL.replace(/\/$/, "")}/v1`
    : process.env.LLM_BASE_URL?.replace(/\/$/, "");
  const model = process.env.LLM_MODEL;
  if (!base || !model) {
    return Response.json({ error: "Assistant is not available right now." }, { status: 503 });
  }
  const isGemini = base.startsWith("https://generativelanguage.googleapis.com/v1beta/openai");

  let upstream: Response;
  const latestQuestion = parsed.messages.at(-1)?.content ?? "";
  const preferredStyle = parsed.language === "te" ? (parsed.script === "native" ? "Reply in Telugu script." : "Reply in Roman Telugu using Latin letters.")
    : parsed.language === "hi" ? (parsed.script === "native" ? "Reply in Devanagari Hindi." : "Reply in Roman Hindi using Latin letters.")
    : parsed.language === "en" ? "Reply in English." : null;
  const style = preferredStyle ?? replyStyle(parsed.messages.find((message) => message.role === "user")?.content ?? latestQuestion);
  const faqContext = findFaqContext(latestQuestion);
  let selectedPolicy = null;
  let claimContext: string | null = null;
  const sessionId = readSessionId(request);
  if (sessionId) {
    try {
      const { getSelectedPolicyForRequest } = await import("@/lib/provider/server");
      selectedPolicy = await getSelectedPolicyForRequest(request);
    } catch {
      console.error("Assistant policy context unavailable");
      // General questions remain available when the demo insurer is offline or expired.
    }
    if (parsed.journeyId) {
      try {
        const { getClaimContext } = await import("@/lib/assistant/claim-context");
        claimContext = await getClaimContext(parsed.journeyId, sessionId);
      } catch { console.error("Assistant claim context lookup failed"); }
    }
  }
  if (parsed.journeyId && !claimContext) {
    console.error("Assistant claim context missing");
    return Response.json({ error: "Your bill assessment is temporarily unavailable. Please try again.", code: "claim_context_unavailable" }, { status: 503 });
  }
  const knowledge = faqContext.length
    ? `Public insurer FAQ notes for general reference (not the customer's policy; product terms vary):\n${faqContext.map((faq) => `Question: ${faq.question}\nAnswer: ${faq.answer}\nSource: ${faq.title} — ${faq.url}`).join("\n\n")}`
    : "No additional public insurer FAQ notes were found. Use connected policy and bill assessment facts when supplied.";
  const billInstruction = parsed.billAttached && claimContext ? "The user has just uploaded this bill. If their request asks whether it is claimable, covered or for a claim overview, begin your answer with exactly these three concise figures in the conversation's language: total policy cover (policyCoverRupees), estimated claim (estimatedPayableRupees), and projected remaining cover after this claim (projectedRemainingCoverRupees). Use only the supplied values; if a value is null say it needs review rather than inventing a number. Label the remaining amount as projected and the estimate as provisional. Then answer the actual question and explain only relevant conditions or missing information. If the user asks an unrelated general question, answer it directly without adding the claim overview." : "";
  try {
    upstream = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.LLM_API_KEY ? { authorization: `Bearer ${process.env.LLM_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model,
        stream: true,
        max_tokens: 900,
        ...(isGemini ? { reasoning_effort: "low" } : { temperature: 0.35 }),
        messages: [{ role: "system", content: [systemPrompt, style, knowledge, policyContext(selectedPolicy), claimContext, billInstruction].filter(Boolean).join("\n\n") }, ...parsed.messages],
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return Response.json({ error: "Assistant could not answer right now. Try again." }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: "Assistant could not answer right now. Try again." }, { status: 502 });
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let cancelled = false;
  const output = new ReadableStream<Uint8Array>({
    async start(controller) {
      const upstreamReader = upstream.body!.getReader();
      reader = upstreamReader;
      let buffer = "";
      const processLine = (line: string) => {
        if (!line.startsWith("data:")) return;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") return;
        try {
          const chunk = JSON.parse(data);
          const text = chunk?.choices?.[0]?.delta?.content;
          if (!cancelled && typeof text === "string" && text) controller.enqueue(encoder.encode(text));
        } catch {
          // Ignore non-text provider events.
        }
      };
      try {
        while (true) {
          const { done, value } = await upstreamReader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";
          for (const line of lines) processLine(line);
        }
        buffer += decoder.decode();
        if (buffer) processLine(buffer);
        if (!cancelled) controller.close();
      } catch {
        if (!cancelled) controller.error(new Error("Assistant stream ended unexpectedly."));
      } finally {
        upstreamReader.releaseLock();
        reader = null;
      }
    },
    async cancel() {
      cancelled = true;
      await reader?.cancel().catch(() => {});
    },
  });

  return new Response(output, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-content-type-options": "nosniff",
    },
  });
}
