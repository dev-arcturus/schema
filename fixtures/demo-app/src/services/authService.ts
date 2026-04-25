import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { DB } from "../db/sqlite.js";
import { createUser, findUserByEmail } from "../repos/userRepo.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-secret-change-me";
const TOKEN_TTL = "7d";

export type AuthResult = {
  token: string;
  userId: number;
  email: string;
};

export async function registerUser(
  db: DB,
  email: string,
  password: string,
): Promise<AuthResult> {
  const existing = findUserByEmail(db, email);
  if (existing) {
    throw new ServiceError("email_taken", 409, "email already registered");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = createUser(db, email, passwordHash);
  const token = signToken(user.id);
  return { token, userId: user.id, email: user.email };
}

export async function loginUser(
  db: DB,
  email: string,
  password: string,
): Promise<AuthResult> {
  const user = findUserByEmail(db, email);
  if (!user) {
    throw new ServiceError("invalid_credentials", 401, "invalid credentials");
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new ServiceError("invalid_credentials", 401, "invalid credentials");
  }
  const token = signToken(user.id);
  return { token, userId: user.id, email: user.email };
}

function signToken(userId: number): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub?: number | string };
    const userId = typeof decoded.sub === "number" ? decoded.sub : Number(decoded.sub);
    if (!Number.isFinite(userId)) return null;
    return { userId };
  } catch {
    return null;
  }
}

export class ServiceError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
