import { z } from "zod";

export const ProviderId = z.enum(["star", "hdfc-ergo"]);
export type ProviderId = z.infer<typeof ProviderId>;

export const ProviderAccount = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
});
export type ProviderAccount = z.infer<typeof ProviderAccount>;

export const ProviderPolicySummary = z.object({
  id: z.string().min(1),
  wordingId: z.string().min(1),
  provider: z.string().min(1),
  product: z.string().min(1),
  policyNumberMasked: z.string().min(1),
  status: z.string().min(1),
});
export type ProviderPolicySummary = z.infer<typeof ProviderPolicySummary>;

export const ProviderPolicy = ProviderPolicySummary.extend({
  policyStart: z.string().min(1),
  continuousCoverSince: z.string().min(1),
  insuredAgeAtEntry: z.number().int().nonnegative(),
  sumInsuredPaise: z.number().int().nonnegative(),
  coPayPct: z.number().min(0).max(100),
  insuredPeople: z.array(z.object({ name: z.string().min(1), relationship: z.string().min(1) })),
});
export type ProviderPolicy = z.infer<typeof ProviderPolicy>;

export const ProviderBalance = z.object({
  policyId: z.string().min(1),
  remainingBalancePaise: z.number().int().nonnegative(),
  asOf: z.string().min(1),
});
export type ProviderBalance = z.infer<typeof ProviderBalance>;

export const TokenResponse = z.object({
  access_token: z.string().min(1),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().positive(),
  scope: z.string(),
});

export type ProviderConnectionRow = {
  id: string;
  session_id: string;
  provider: ProviderId;
  account_id: string;
  access_token_ciphertext: string;
  scope: string;
  expires_at: string;
  selected_policy_id: string | null;
  policy_snapshot: ProviderPolicy | null;
  balance_snapshot: ProviderBalance | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};
