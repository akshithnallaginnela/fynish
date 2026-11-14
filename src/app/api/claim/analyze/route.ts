import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { assessBill } from "@/lib/claim/assessment";
import { extractDocument, ExtractionError } from "@/lib/claim/extract";
import { getSelectedPolicyForRequest, ProviderError } from "@/lib/provider/server";
import { sameOrigin } from "@/lib/provider/http";
import { hdfcDemoClauses } from "@/policy/hdfc-demo";
import { lookup } from "@/policy/lookup";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "invalid_origin" }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 32 * 1024 * 1024) return Response.json({ error: "Uploads must total under 32 MB." }, { status: 413 });

  try {
    const selected = await getSelectedPolicyForRequest(request);
    if (!selected) return Response.json({ error: "Connect an insurer and select a policy first." }, { status: 409 });
    if (selected.policy.status !== "ACTIVE") return Response.json({ error: "Select an active policy." }, { status: 409 });

    let form: FormData;
    try { form = await request.formData(); } catch { return Response.json({ error: "Invalid upload form." }, { status: 400 }); }
    const billFile = form.get("bill");
    const dischargeFile = form.get("discharge");
    const receiptFile = form.get("receipt");
    const paymentOrderId = form.get("paymentOrderId");
    if (!(billFile instanceof File) || (dischargeFile && !(dischargeFile instanceof File)) || (receiptFile && !(receiptFile instanceof File))) {
      return Response.json({ error: "Upload a hospital bill; discharge summary and receipt are optional." }, { status: 400 });
    }
    const billResult = await extractDocument(billFile, "bill");
    const dischargeResult = dischargeFile instanceof File ? await extractDocument(dischargeFile, "discharge") : null;
    const receiptResult = receiptFile instanceof File ? await extractDocument(receiptFile, "receipt") : null;
    const bill = billResult.data;
    const dischargeSummary = dischargeResult?.data;
    let paymentSignal: { order_id: string; hospital_name: string; amount_paise: number; payment_id: string | null; paid_at: string | null } | null = null;
    if (typeof paymentOrderId === "string" && paymentOrderId.length <= 64) {
      const { data, error } = await db.from("payment_signals").select("order_id,hospital_name,amount_paise,payment_id,paid_at")
        .eq("order_id", paymentOrderId).eq("session_id", selected.sessionId).eq("status", "paid").maybeSingle();
      if (error) throw error;
      paymentSignal = data;
    }
    // A transaction is a signal, not a receipt or an itemised hospital bill.
    const receipt = receiptResult?.data;
    const { readiness, amountSummary, warnings } = assessBill({
      bill,
      dischargeSummary,
      receipt,
      policy: selected.policy,
      remainingBalancePaise: selected.balance.remainingBalancePaise,
      today: new Date().toISOString().slice(0, 10),
    });
    if (receipt) {
      warnings.push("Receipt details were read automatically. Confirm the receipt belongs to this bill before filing.");
      if (receipt.amountPaise !== bill.totalAmountPaise) warnings.push("The receipt amount differs from the bill total. Check whether it is a partial payment or a different receipt.");
    }
    let paymentCheck: "matched" | "amount_mismatch" | "hospital_mismatch" | undefined;
    if (paymentSignal) {
      const billHospital = new Set(bill.hospitalName.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
      const transactionHospital = paymentSignal.hospital_name.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
      const hospitalMatches = transactionHospital.some((word) => word.length > 2 && billHospital.has(word));
      paymentCheck = paymentSignal.amount_paise !== bill.totalAmountPaise ? "amount_mismatch" : hospitalMatches ? "matched" : "hospital_mismatch";
      if (paymentCheck === "amount_mismatch") warnings.push("The checkout payment amount differs from the bill total. Review both records.");
      if (paymentCheck === "hospital_mismatch") warnings.push("The checkout payment hospital name differs from the bill. Review both records.");
    }

    const refs = [...new Set([
      ...readiness.breakdown.filter((result) => result.passed === false).flatMap((result) => result.clauseRefs),
      ...amountSummary.items.flatMap((item) => item.clauseRef ? [item.clauseRef] : []),
    ])];
    const citations = await Promise.all(refs.map(async (clauseRef) => {
      if (selected.provider === "hdfc-ergo") {
        const text = hdfcDemoClauses[clauseRef] ?? null;
        return { clauseRef, page: null, text, source: text ? "synthetic_demo" : "unavailable" };
      }
      try {
        const hit = await lookup(clauseRef, selected.policy.wordingId);
        return { clauseRef, page: hit?.page ?? null, text: hit?.text ?? null, source: hit ? "policy_wording" : "unavailable" };
      } catch {
        return { clauseRef, page: null, text: null, source: "unavailable" };
      }
    }));
    if (citations.some((c) => c.source === "unavailable")) warnings.push("Some referenced terms could not be checked. Confirm them with your insurer.");
    if (selected.provider === "star") warnings.push("The amount is provisional; the insurer checks all policy conditions and exclusions.");

    const journeyId = randomUUID();
    const uploads = [
      { kind: "bill", result: billResult },
      ...(dischargeResult ? [{ kind: "discharge_summary", result: dischargeResult }] : []),
      ...(receiptResult ? [{ kind: "receipt", result: receiptResult }] : []),
    ];
    const paths: string[] = [];
    try {
      for (const upload of uploads) {
        const path = `${selected.sessionId}/${journeyId}/${upload.kind}`;
        const { error } = await db.storage.from("claim-documents").upload(path, upload.result.bytes, { contentType: upload.result.mime, upsert: false });
        if (error) throw error;
        paths.push(path);
      }
      const assessment = {
        readiness,
        amountSummary,
        citations,
        warnings,
        policySnapshot: {
          id: selected.policy.id,
          wordingId: selected.policy.wordingId,
          product: selected.policy.product,
          policyStart: selected.policy.policyStart,
          continuousCoverSince: selected.policy.continuousCoverSince,
          insuredAgeAtEntry: selected.policy.insuredAgeAtEntry,
          sumInsuredPaise: selected.policy.sumInsuredPaise,
          coPayPct: selected.policy.coPayPct,
          remainingBalancePaise: selected.balance.remainingBalancePaise,
          balanceAsOf: selected.balance.asOf,
        },
      };
      const { error: journeyError } = await db.from("journeys").insert({
        id: journeyId,
        type: "claim",
        state: "scoring",
        customer_id: selected.sessionId,
        policy_id: selected.policy.wordingId,
        provider_policy_id: selected.policy.id,
        connection_id: selected.connectionId,
        extracted: {
          bill,
          ...(dischargeSummary ? { dischargeSummary } : {}),
          ...(receipt ? { receipt } : {}),
        },
        score: readiness.score,
        score_breakdown: readiness.breakdown,
        assessment,
      });
      if (journeyError) throw journeyError;
      const { error: documentsError } = await db.from("documents").insert(uploads.map((upload, i) => ({
        journey_id: journeyId,
        kind: upload.kind,
        storage_path: paths[i],
        sha256: createHash("sha256").update(upload.result.bytes).digest("hex"),
        extracted: upload.result.data,
      })));
      if (documentsError) {
        await db.from("journeys").delete().eq("id", journeyId);
        throw documentsError;
      }
      return Response.json({
        journeyId, bill, ...(dischargeSummary ? { dischargeSummary } : {}), readiness, amountSummary, citations, warnings,
        policySnapshot: { sumInsuredPaise: selected.policy.sumInsuredPaise, remainingBalancePaise: selected.balance.remainingBalancePaise },
        ...(paymentCheck ? { paymentCheck } : {}),
      });
    } catch {
      if (paths.length) await db.storage.from("claim-documents").remove(paths);
      return Response.json({ error: "Could not save the assessment. Try again." }, { status: 502 });
    }
  } catch (error) {
    if (error instanceof ExtractionError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof ProviderError && error.code === "connection_expired") {
      return Response.json({ error: "Your insurance connection expired. Reconnect your insurer and select a policy.", code: error.code }, { status: 409 });
    }
    if (error instanceof ProviderError) {
      return Response.json({ error: "The insurance connection is unavailable. Please try again shortly.", code: error.code }, { status: 503 });
    }
    return Response.json({ error: "Could not load the selected policy. Reconnect the provider and try again." }, { status: 502 });
  }
}
