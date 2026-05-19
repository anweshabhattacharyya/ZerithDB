import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import { DbClient } from "../db-client.js";
import type { VectorClock } from "zerithdb-core";

function createDb(appId = crypto.randomUUID()): DbClient {
  return new DbClient({ appId } as any);
}

async function waitForHydration(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

describe("findAtTick (time-travel queries)", () => {
  it("replays insert operations correctly", async () => {
    const db = createDb();
    const col = db.collection<any>("users");

    await col.insert({ name: "A" });
    await col.insert({ name: "B" });

    const vc: VectorClock = { local: 10 };

    const result = await col.findAtTick({}, vc);

    expect(result.length).toBe(2);
    await db.dispose();
  });

  it("replays update operations correctly", async () => {
    const db = createDb();
    const col = db.collection<any>("users");

    const { id } = await col.insert({ name: "A" });

    await col.update({ _id: id }, { $set: { name: "B" } });

    const vc: VectorClock = { local: 10 };

    const result = await col.findAtTick({}, vc);

    expect(result[0].name).toBe("B");
    await db.dispose();
  });

  it("replays delete operations correctly", async () => {
    const db = createDb();
    const col = db.collection<any>("users");

    await col.insert({ name: "A" });
    await col.delete({ name: "A" });

    const vc: VectorClock = { local: 10 };

    const result = await col.findAtTick({}, vc);

    expect(result.length).toBe(0);
    await db.dispose();
  });

  it("reconstructs multiple sequential updates", async () => {
    const db = createDb();
    const col = db.collection<any>("users");

    const { id } = await col.insert({ name: "A" });
    await col.update({ _id: id }, { $set: { name: "B" } });
    await col.update({ _id: id }, { $set: { name: "C" } });

    const result = await col.findAtTick({}, { local: 3 });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("C");
    await db.dispose();
  });

  it("handles partial vector clocks", async () => {
    const db = createDb();
    const col = db.collection<any>("users");

    await col.insert({ name: "A" });

    const result = await col.findAtTick({}, {});

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("A");
    await db.dispose();
  });

  it("returns empty state for empty history", async () => {
    const db = createDb();
    const col = db.collection<any>("users");

    const result = await col.findAtTick({}, { local: 10 });

    expect(result).toEqual([]);
    await db.dispose();
  });

  it("removes updated documents after delete", async () => {
    const db = createDb();
    const col = db.collection<any>("users");

    const { id } = await col.insert({ name: "A" });
    await col.update({ _id: id }, { $set: { name: "B" } });
    await col.delete({ _id: id });

    const result = await col.findAtTick({}, { local: 3 });

    expect(result).toEqual([]);
    await db.dispose();
  });

  it("hydrates persisted operation history on startup", async () => {
    const appId = crypto.randomUUID();
    const firstDb = createDb(appId);
    const firstUsers = firstDb.collection<any>("users");

    const { id } = await firstUsers.insert({ name: "A" });
    await firstUsers.update({ _id: id }, { $set: { name: "Persisted" } });
    await firstDb.dispose();

    const secondDb = createDb(appId);
    const secondUsers = secondDb.collection<any>("users");
    await waitForHydration();

    const result = await secondUsers.findAtTick({}, { local: 2 });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Persisted");
    await secondDb.dispose();
  });
});
