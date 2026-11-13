import { db } from "./db";
import type { EventKind } from "./types";

export async function appendEvent(journeyId: string, kind: EventKind, payload: Record<string, unknown> = {}) {
  const { error } = await db.from("events").insert({ journey_id: journeyId, kind, payload });
  if (error) throw error;
}
