import { createApp } from "../src/app.js";
import { openDatabase, type DB } from "../src/db/sqlite.js";

export function makeApp(): { app: ReturnType<typeof createApp>; db: DB } {
  const db = openDatabase(":memory:");
  const app = createApp(db);
  return { app, db };
}
