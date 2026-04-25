import express, { type Express } from "express";
import type { DB } from "./db/sqlite.js";
import { runMigrations } from "./db/migrations.js";
import { identifyUser } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { todosRouter } from "./routes/todos.js";

export function createApp(db: DB): Express {
  runMigrations(db);

  const app = express();
  app.use(express.json());
  app.use(identifyUser);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/auth", authRouter(db));
  app.use("/todos", todosRouter(db));

  app.use(errorHandler);
  return app;
}
