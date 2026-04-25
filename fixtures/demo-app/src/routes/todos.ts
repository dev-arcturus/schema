import { Router } from "express";
import type { DB } from "../db/sqlite.js";
import { makeTodoRepo } from "../repos/todoRepoImpl.js";
import { requireAuth } from "../middleware/auth.js";
import { addTodo, getTodos, removeTodo } from "../services/todoService.js";
import { ServiceError } from "../services/authService.js";

export function todosRouter(db: DB): Router {
  const router = Router();
  const todoRepo = makeTodoRepo(db);

  router.get("/", requireAuth, (req, res, next) => {
    try {
      const userId = req.userId ?? 0;
      const todos = getTodos(todoRepo, userId);
      res.json({ todos });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", requireAuth, (req, res, next) => {
    try {
      const userId = req.userId!;
      const { title } = req.body ?? {};
      if (typeof title !== "string") {
        throw new ServiceError("invalid_body", 400, "title required");
      }
      const todo = addTodo(todoRepo, userId, title);
      res.status(201).json(todo);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", requireAuth, (req, res, next) => {
    try {
      const userId = req.userId ?? 0;
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        throw new ServiceError("invalid_id", 400, "invalid todo id");
      }
      removeTodo(todoRepo, userId, id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
