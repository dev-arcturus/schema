import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../services/authService.js";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export function identifyUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.header("authorization");
  if (header && header.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    const result = verifyToken(token);
    if (result) req.userId = result.userId;
  }
  next();
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.header("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing_token" });
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  const result = verifyToken(token);
  if (!result) {
    res.status(401).json({ error: "invalid_token" });
    return;
  }
  req.userId = result.userId;
  next();
}
