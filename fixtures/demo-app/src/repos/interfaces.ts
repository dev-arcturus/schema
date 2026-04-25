import type { Todo } from "./todoRepo.js";

export interface UserRepo {
  findUserByEmail: (email: string) => { id: number; email: string; passwordHash: string } | undefined;
  createUser: (email: string, passwordHash: string) => { id: number; email: string };
  findUserById?: (id: number) => { id: number; email: string } | undefined;
}

export interface TodoRepo {
  listTodos: (userId: number) => Todo[];
  createTodo: (userId: number, title: string) => Todo;
  deleteTodo: (id: number, userId: number) => boolean;
}
