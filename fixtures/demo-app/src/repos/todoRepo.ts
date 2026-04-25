import type { DB } from "../db/sqlite.js";

export type Todo = {
  id: number;
  userId: number;
  title: string;
  done: boolean;
  createdAt: string;
};

type Row = {
  id: number;
  user_id: number;
  title: string;
  done: number;
  created_at: string;
};

function toTodo(row: Row): Todo {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    done: row.done === 1,
    createdAt: row.created_at,
  };
}

export function listTodos(db: DB, userId: number): Todo[] {
  const rows = db
    .prepare(
      "SELECT id, user_id, title, done, created_at FROM todos WHERE user_id = ? ORDER BY id DESC",
    )
    .all(userId) as Row[];
  return rows.map(toTodo);
}

export function createTodo(db: DB, userId: number, title: string): Todo {
  const row = db
    .prepare(
      "INSERT INTO todos (user_id, title) VALUES (?, ?) RETURNING id, user_id, title, done, created_at",
    )
    .get(userId, title) as Row;
  return toTodo(row);
}

export function deleteTodo(db: DB, userId: number, id: number): boolean {
  const result = db
    .prepare("DELETE FROM todos WHERE id = ? AND user_id = ?")
    .run(id, userId);
  return result.changes > 0;
}
