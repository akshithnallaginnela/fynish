import { simulatedBankAccount, simulatedBankConnected } from "@/lib/bank/simulation";

export function GET(request: Request) {
  const connected = simulatedBankConnected(request);
  return Response.json({ connected, source: "simulation", ...(connected ? { account: simulatedBankAccount } : {}) }, { headers: { "Cache-Control": "no-store" } });
}
