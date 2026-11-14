import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key() {
  const value = process.env.PROVIDER_TOKEN_KEY;
  if (!value) throw new Error("Set PROVIDER_TOKEN_KEY to a base64-encoded 32-byte key");
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error("PROVIDER_TOKEN_KEY must be a base64-encoded 32-byte key");
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) throw new Error("PROVIDER_TOKEN_KEY must decode to 32 bytes");
  return decoded;
}

export function seal(plaintext: string, purpose: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(`fynish:${purpose}`));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function open(sealed: string, purpose: string) {
  const [version, ivText, tagText, bodyText, extra] = sealed.split(".");
  if (version !== "v1" || !ivText || !tagText || bodyText === undefined || extra !== undefined) {
    throw new Error("Invalid sealed value");
  }
  const iv = Buffer.from(ivText, "base64url");
  const tag = Buffer.from(tagText, "base64url");
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid sealed value");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAAD(Buffer.from(`fynish:${purpose}`));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(bodyText, "base64url")), decipher.final()]).toString("utf8");
}

export function randomUrlSafe(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}
