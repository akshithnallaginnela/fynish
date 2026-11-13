import assert from "node:assert/strict";
import { db, getJourney, insertJourney } from "../src/lib/db";
import { appendEvent } from "../src/lib/events";

const j = await insertJourney({ type: "claim", customerId: "smoke" });
await appendEvent(j.id, "transition", { to: "triggered" });
const back = await getJourney(j.id);
assert.equal(back.customerId, "smoke");
assert.equal(back.state, "triggered");

const { error } = await db.from("events").delete().eq("journey_id", j.id);
assert.match(error?.message ?? "", /append-only/);

console.log("db smoke ok", j.id);
