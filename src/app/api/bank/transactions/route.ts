import { simulatedBankConnected, simulatedTransactions } from "@/lib/bank/simulation";

export function GET(request: Request) {
  if (!simulatedBankConnected(request)) return Response.json({ error: "Connect the sample bank account first." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return Response.json({ transactions: simulatedTransactions, source: "simulation" }, { headers: { "Cache-Control": "no-store" } });
}
