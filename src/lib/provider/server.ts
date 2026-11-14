import { db } from "@/lib/db";
import { open, seal } from "./crypto";
import { providerBase } from "./config";
import { readSessionId } from "./session";
import {
  ProviderAccount,
  ProviderBalance,
  ProviderPolicy,
  ProviderPolicySummary,
  type ProviderConnectionRow,
  type ProviderId,
} from "./types";
import { z } from "zod";

export class ProviderError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
  }
}

export async function getConnection(sessionId: string) {
  const { data, error } = await db
    .from("provider_connections")
    .select()
    .eq("session_id", sessionId)
    .is("revoked_at", null)
    .maybeSingle<ProviderConnectionRow>();
  if (error) throw error;
  return data;
}

export async function saveConnection(args: {
  sessionId: string;
  provider: ProviderId;
  accountId: string;
  accessToken: string;
  expiresIn: number;
  scope: string;
}) {
  const { data, error } = await db.from("provider_connections").upsert({
    session_id: args.sessionId,
    provider: args.provider,
    account_id: args.accountId,
    access_token_ciphertext: seal(args.accessToken, "token"),
    expires_at: new Date(Date.now() + args.expiresIn * 1000).toISOString(),
    scope: args.scope,
    selected_policy_id: null,
    policy_snapshot: null,
    balance_snapshot: null,
    revoked_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "session_id" }).select().single<ProviderConnectionRow>();
  if (error) throw error;
  return data;
}

export async function revokeConnection(sessionId: string) {
  const { error } = await db.from("provider_connections").update({
    access_token_ciphertext: "",
    selected_policy_id: null,
    policy_snapshot: null,
    balance_snapshot: null,
    revoked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("session_id", sessionId);
  if (error) throw error;
}

function accessToken(connection: ProviderConnectionRow) {
  if (new Date(connection.expires_at).getTime() <= Date.now() || !connection.access_token_ciphertext) {
    throw new ProviderError("connection_expired", 401, "Provider connection expired. Connect again.");
  }
  return open(connection.access_token_ciphertext, "token");
}

export async function providerApi(connection: ProviderConnectionRow, path: string, init?: RequestInit) {
  if (!path.startsWith("/api/") || path.startsWith("//")) throw new Error("Invalid provider API path");
  const token = accessToken(connection);
  let response: Response;
  try {
    response = await fetch(`${providerBase(connection.provider)}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ProviderError("provider_unavailable", 502, "Provider mock is unavailable.");
  }
  if (response.status === 401) throw new ProviderError("connection_expired", 401, "Provider connection expired. Connect again.");
  if (!response.ok) throw new ProviderError("provider_api_error", 502, "Provider mock API did not complete the request.");
  try {
    return await response.json() as unknown;
  } catch {
    throw new ProviderError("provider_api_error", 502, "Provider mock returned invalid JSON.");
  }
}

function expectProvider<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ProviderError("provider_api_error", 502, "Provider mock returned invalid data.");
  return parsed.data;
}

export async function getProviderAccount(connection: ProviderConnectionRow) {
  return expectProvider(ProviderAccount, await providerApi(connection, "/api/me"));
}

export async function getProviderPolicies(connection: ProviderConnectionRow) {
  const data = expectProvider(z.object({ policies: z.array(ProviderPolicySummary) }), await providerApi(connection, "/api/policies"));
  return data.policies;
}

export async function getProviderPolicy(connection: ProviderConnectionRow, policyId: string) {
  const data = expectProvider(z.object({ policy: ProviderPolicy }),
    await providerApi(connection, `/api/policies/${encodeURIComponent(policyId)}`),
  );
  if (data.policy.id !== policyId) throw new ProviderError("provider_api_error", 502, "Provider returned the wrong policy.");
  return data.policy;
}

export async function getProviderBalance(connection: ProviderConnectionRow, policyId: string) {
  const data = expectProvider(ProviderBalance,
    await providerApi(connection, `/api/policies/${encodeURIComponent(policyId)}/balance`),
  );
  if (data.policyId !== policyId) throw new ProviderError("provider_api_error", 502, "Provider returned the wrong balance.");
  return data;
}

export async function selectPolicy(connection: ProviderConnectionRow, policyId: string) {
  const [policy, balance] = await Promise.all([
    getProviderPolicy(connection, policyId),
    getProviderBalance(connection, policyId),
  ]);
  if (policy.status.toUpperCase() !== "ACTIVE") throw new ProviderError("policy_inactive", 400, "Select an active policy.");
  const { error } = await db.from("provider_connections").update({
    selected_policy_id: policyId,
    policy_snapshot: policy,
    balance_snapshot: balance,
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id);
  if (error) throw error;
  return { policy, balance };
}

export async function getSessionView(sessionId: string) {
  const connection = await getConnection(sessionId);
  if (!connection) return { connected: false as const };
  const [account, policies] = await Promise.all([
    getProviderAccount(connection),
    getProviderPolicies(connection),
  ]);
  const selectedPolicyId = connection.selected_policy_id;
  const [selectedPolicy, balance] = selectedPolicyId
    ? await Promise.all([
      getProviderPolicy(connection, selectedPolicyId),
      getProviderBalance(connection, selectedPolicyId),
    ])
    : [null, null];
  return {
    connected: true as const,
    provider: connection.provider,
    account,
    policies,
    selectedPolicyId,
    selectedPolicy,
    balance,
  };
}

export async function getSelectedPolicyForRequest(request: Request) {
  const sessionId = readSessionId(request);
  if (!sessionId) return null;
  const connection = await getConnection(sessionId);
  if (!connection?.selected_policy_id) return null;
  const policyId = connection.selected_policy_id;
  const [policy, balance] = await Promise.all([
    getProviderPolicy(connection, policyId),
    getProviderBalance(connection, policyId),
  ]);
  return { connectionId: connection.id, sessionId, provider: connection.provider, policy, balance };
}
