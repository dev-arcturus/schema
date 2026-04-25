import type { DB } from "../db/sqlite.js";
import type { TodoRepo } from "../services/todoService.js";
import { createTodo, deleteTodo, listTodos } from "./todoRepo.js";

export function makeTodoRepo(db: DB): TodoRepo {
  return {
    listTodos: (userId) => listTodos(db, userId),
    createTodo: (userId, title) => createTodo(db, userId, title),
    deleteTodo: (id, userId) => deleteTodo(db, id, userId),
  };
}
