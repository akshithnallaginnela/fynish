import { appOrigin } from "./config";

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const configured = appOrigin();
  if (origin === configured) return true;
  if (process.env.NODE_ENV === "production" || !origin) return false;
  try {
    const expected = new URL(configured);
    const incoming = new URL(origin);
    const target = new URL(request.url);
    const loopback = (host: string) => host === "localhost" || host === "127.0.0.1";
    return loopback(expected.hostname) && loopback(incoming.hostname) &&
      incoming.origin === target.origin && incoming.protocol === expected.protocol &&
      incoming.port === expected.port;
  } catch {
    return false;
  }
}
