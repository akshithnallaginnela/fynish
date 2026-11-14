import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ProviderError } from "./server";
export { sameOrigin } from "./origin";

export function routeError(error: unknown) {
  if (error instanceof ProviderError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  console.error("Provider route failed", error);
  return NextResponse.json({ error: "server_error" }, { status: 500 });
}
