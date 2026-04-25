import { Router } from "express";
import type { DB } from "../db/sqlite.js";
import { loginUser, registerUser, ServiceError } from "../services/authService.js";

export function authRouter(db: DB): Router {
  const router = Router();

  router.post("/register", async (req, res, next) => {
    try {
      const { email, password } = req.body ?? {};
      if (typeof email !== "string" || typeof password !== "string") {
        throw new ServiceError("invalid_body", 400, "email and password required");
      }
      const result = await registerUser(db, email, password);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      const { email, password } = req.body ?? {};
      if (typeof email !== "string" || typeof password !== "string") {
        throw new ServiceError("invalid_body", 400, "email and password required");
      }
      const result = await loginUser(db, email, password);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
