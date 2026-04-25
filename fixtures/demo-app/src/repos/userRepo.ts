import type { DB } from "../db/sqlite.js";

export type User = {
  id: number;
  email: string;
  passwordHash: string;
};

export function createUser(db: DB, email: string, passwordHash: string): User {
  const stmt = db.prepare(
    "INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id, email, password_hash",
  );
  const row = stmt.get(email, passwordHash) as {
    id: number;
    email: string;
    password_hash: string;
  };
  return { id: row.id, email: row.email, passwordHash: row.password_hash };
}

export function findUserByEmail(db: DB, email: string): User | null {
  const row = db
    .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
    .get(email) as
    | { id: number; email: string; password_hash: string }
    | undefined;
  if (!row) return null;
  return { id: row.id, email: row.email, passwordHash: row.password_hash };
}

export function findUserById(db: DB, id: number): User | null {
  const row = db
    .prepare("SELECT id, email, password_hash FROM users WHERE id = ?")
    .get(id) as { id: number; email: string; password_hash: string } | undefined;
  if (!row) return null;
  return { id: row.id, email: row.email, passwordHash: row.password_hash };
}
