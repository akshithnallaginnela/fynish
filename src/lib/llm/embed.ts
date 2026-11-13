import { z } from "zod";

const EmbedResponse = z.object({ data: z.array(z.object({ embedding: z.array(z.number()) })) });

// OpenAI-compatible /embeddings; OLLAMA_BASE_URL switches to a local Ollama.
export async function embed(texts: string[]): Promise<number[][]> {
  const base = process.env.OLLAMA_BASE_URL ? `${process.env.OLLAMA_BASE_URL}/v1` : process.env.LLM_BASE_URL;
  const res = await fetch(`${base}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LLM_API_KEY ?? "ollama"}` },
    body: JSON.stringify({ model: process.env.EMBED_MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${await res.text()}`);
  return EmbedResponse.parse(await res.json()).data.map((d) => d.embedding);
}
