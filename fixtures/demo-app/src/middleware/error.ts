import type { NextFunction, Request, Response } from "express";
import { ServiceError } from "../services/authService.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ServiceError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  console.error("[unhandled]", err);
  res.status(500).json({ error: "internal_error" });
}
