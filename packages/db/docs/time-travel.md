# Time Travel Queries

```ts
const db = new DbClient({ appId: "demo" });

const users = db.collection("users");

await users.insert({ name: "Alice" });

const historical = await users.findAtTick({}, { local: 1 });
```

## Notes

- Queries replay operation history in memory.
- Operation logs are persisted in IndexedDB.
- Replay is currently capped for performance.
- Currently optimized for recent history.
- Future snapshotting planned.
- Intended for debugging, audit trails, and offline history inspection.
