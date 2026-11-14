export const DEMO_MERCHANTS = {
  hospital: { id: "hospital", name: "Apollo Hospitals", category: "hospital", amountPaise: 4_200_000 },
  store: { id: "store", name: "City Market", category: "other", amountPaise: 50_000 },
} as const;

export type DemoMerchantId = keyof typeof DEMO_MERCHANTS;

export function classifyDemoMerchant(name: string) {
  return Object.values(DEMO_MERCHANTS).find((merchant) => merchant.name === name) ?? null;
}
