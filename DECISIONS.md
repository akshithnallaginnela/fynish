# Decisions

- Keep Next 16.4.6 scaffold instead of Next 15: already generated, no API we use differs.
- LLM is Qwen2.5-VL on an OpenAI-compatible endpoint behind LLMProvider; OLLAMA_BASE_URL switches to local.
- No shadcn init in skeleton: add when the first component needs it.
- Dev deps: vitest (test runner), zod (schemas at every boundary). @types/node bumped to 22 for vitest peer.
