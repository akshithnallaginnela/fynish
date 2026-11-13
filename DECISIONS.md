# Decisions

- Keep Next 16.4.6 scaffold instead of Next 15: already generated, no API we use differs.
- LLM is Qwen2.5-VL on an OpenAI-compatible endpoint behind LLMProvider; OLLAMA_BASE_URL switches to local.
- No shadcn init in skeleton: add when the first component needs it.
- Dev deps: vitest (test runner), zod (schemas at every boundary). @types/node bumped to 22 for vitest peer.
- tsx dev dep: runs seed/smoke scripts with .env; no build step.
- policy_chunks.embedding is vector with no dim: Qwen embed dims vary, 16-page PDF needs no index.
- events append-only enforced by DB trigger, not only by convention.
- Spec table of deductions wins over its score examples: discharge 18 + room 10 gives 72 / 90 / 65, not 72 / 82 / 57 (the 82 is arithmetic drift in rules.spec v2).
- One test file per rule folded into rules.test.ts with a describe per rule; score.test.ts covers evaluateAll.
- vitest runs with pool vmForks: default pools break on Node 26 + vitest 5.1.
- pdf-parse dep: stack lock; reads CIS text per page.
- Embeddings via OpenAI-compatible /embeddings (EMBED_MODEL); seed skips them while unset. Lookup is by clause ref, embeddings are for later free-text search.
- CIS clause refs sit at the end of the row they cite, so a line ending in refs closes a chunk; page numbers are physical PDF pages (PDF has 17 incl. cover, spec says 16).
