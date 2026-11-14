import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // shortcut: vmForks pool; default pools yield "reading 'config'" on Node 26 + vitest 5.1, drop when vitest fixes it
  test: { pool: "vmForks", exclude: [...configDefaults.exclude, "provider-mocks/**"] },
});
