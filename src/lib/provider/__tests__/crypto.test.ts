import { afterEach, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { open, pkceChallenge, seal } from "../crypto";

const oldKey = process.env.PROVIDER_TOKEN_KEY;
afterEach(() => { process.env.PROVIDER_TOKEN_KEY = oldKey; });

it("encrypts tokens for one purpose and rejects tampering", () => {
  process.env.PROVIDER_TOKEN_KEY = randomBytes(32).toString("base64");
  const encrypted = seal("demo-token", "token");
  expect(encrypted).not.toContain("demo-token");
  expect(open(encrypted, "token")).toBe("demo-token");
  expect(() => open(encrypted, "session")).toThrow();
  const [version, iv, tag, body] = encrypted.split(".");
  const changedBody = `${body[0] === "A" ? "B" : "A"}${body.slice(1)}`;
  expect(() => open([version, iv, tag, changedBody].join("."), "token")).toThrow();
});

it("matches the RFC 7636 S256 example", () => {
  expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"))
    .toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});
