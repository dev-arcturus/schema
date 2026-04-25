import type { DB } from "../db/sqlite.js";
import {
  createTodo,
  deleteTodo,
  listTodos,
  type Todo,
} from "../repos/todoRepo.js";
import { ServiceError } from "./authService.js";

export function getTodos(db: DB, userId: number): Todo[] {
  return listTodos(db, userId);
}

export function addTodo(db: DB, userId: number, title: string): Todo {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new ServiceError("invalid_title", 400, "title cannot be empty");
  }
  return createTodo(db, userId, trimmed);
}

export function removeTodo(db: DB, userId: number, id: number): void {
  const ok = deleteTodo(db, userId, id);
  if (!ok) {
    throw new ServiceError("not_found", 404, "todo not found");
  }
}
