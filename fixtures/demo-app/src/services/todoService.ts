import type { Todo } from "../repos/todoRepo.js";
import { ServiceError } from "./authService.js";

export interface TodoRepo {
  listTodos: (userId: number) => Todo[];
  createTodo: (userId: number, title: string) => Todo;
  deleteTodo: (id: number, userId: number) => boolean;
}

export function getTodos(todoRepo: TodoRepo, userId: number): Todo[] {
  return todoRepo.listTodos(userId);
}

export function addTodo(todoRepo: TodoRepo, userId: number, title: string): Todo {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new ServiceError("invalid_title", 400, "title cannot be empty");
  }
  return todoRepo.createTodo(userId, trimmed);
}

export function removeTodo(todoRepo: TodoRepo, userId: number, id: number): void {
  const ok = todoRepo.deleteTodo(id, userId);
  if (!ok) {
    throw new ServiceError("not_found", 404, "todo not found");
  }
}
